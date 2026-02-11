import { DataAnalyst, type StreamEvent, type TablePermissionsConfig } from '@analytique/agent';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Zod schemas for input validation
const AccessLevelSchema = z.enum(['full', 'read', 'none']);

const TablePermissionSchema = z.object({
  table: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Table name must be a valid SQL identifier',
  }),
  schema: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Schema name must be a valid SQL identifier',
  }),
  accessLevel: AccessLevelSchema,
  blockedColumns: z.array(
    z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
      message: 'Column name must be a valid SQL identifier',
    })
  ).optional(),
});

const TablePermissionsConfigSchema = z.object({
  defaultAccess: AccessLevelSchema,
  tables: z.array(TablePermissionSchema).max(1000), // Limit to prevent abuse
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000).trim(), // Reasonable limits
  conversationId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'Conversation ID must be alphanumeric with dashes/underscores',
  }).optional(),
  permissions: TablePermissionsConfigSchema.optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Store analysts per conversation (in production, use Redis or similar)
const analysts = new Map<string, DataAnalyst>();

// Store current permissions config (in production, use database or Redis)
const currentPermissions: TablePermissionsConfig = {
  defaultAccess: 'read',
  tables: [],
};

// Store permissions hash to detect changes
const permissionsHash = new Map<string, string>();

function hashPermissions(perms: TablePermissionsConfig): string {
  return JSON.stringify({
    defaultAccess: perms.defaultAccess,
    tables: perms.tables.map(t => `${t.table}:${t.accessLevel}`).sort(),
  });
}

function getAnalyst(conversationId: string, permissions?: TablePermissionsConfig): DataAnalyst {
  const perms = permissions || currentPermissions;
  const newHash = hashPermissions(perms);
  const existingHash = permissionsHash.get(conversationId);

  // Recreate analyst if permissions have changed
  if (analysts.has(conversationId) && existingHash !== newHash) {
    analysts.delete(conversationId);
  }

  if (!analysts.has(conversationId)) {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are not configured');
    }

    analysts.set(
      conversationId,
      new DataAnalyst({
        anthropicApiKey,
        supabase: {
          supabaseUrl,
          supabaseKey,
          queryTimeout: 30000,
          maxRows: 1000,
          permissions: perms,
        },
      })
    );
    permissionsHash.set(conversationId, newHash);
  }

  return analysts.get(conversationId)!;
}

export async function POST(request: Request) {
  try {
    // Parse and validate request body with Zod
    const rawBody = await request.json();
    const parseResult = ChatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      console.error('[Chat API] Validation failed:', errors);
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: errors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    const { message, conversationId = 'default' } = body;

    // Debug logging for permissions (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Received validated request:', {
        conversationId,
        messageLength: message.length,
        hasPermissions: !!body.permissions,
        permissionsConfig: body.permissions ? {
          defaultAccess: body.permissions.defaultAccess,
          tableCount: body.permissions.tables?.length || 0,
          tables: body.permissions.tables?.map(t => `${t.table}:${t.accessLevel}`)
        } : null
      });
    }

    const analyst = getAnalyst(conversationId, body.permissions);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of analyst.chatStream(message)) {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errorEvent: StreamEvent = {
            type: 'error',
            content: error instanceof Error ? error.message : 'Unknown error occurred',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Schema for DELETE request query params
const DeleteRequestSchema = z.object({
  conversationId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'Conversation ID must be alphanumeric with dashes/underscores',
  }).optional(),
});

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const rawParams = {
      conversationId: url.searchParams.get('conversationId') || undefined,
    };

    const parseResult = DeleteRequestSchema.safeParse(rawParams);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conversationId = parseResult.data.conversationId || 'default';

    if (analysts.has(conversationId)) {
      analysts.get(conversationId)!.clearHistory();
      analysts.delete(conversationId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to clear conversation' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
