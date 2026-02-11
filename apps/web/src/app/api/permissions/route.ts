import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Zod schemas for input validation
const SQLIdentifierSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Must be a valid SQL identifier (letters, numbers, underscores, starting with letter or underscore)',
  });

const AccessLevelSchema = z.enum(['full', 'read', 'none']);

const TablePermissionSchema = z.object({
  table: SQLIdentifierSchema,
  schema: SQLIdentifierSchema,
  accessLevel: AccessLevelSchema,
  allowedColumns: z.array(SQLIdentifierSchema).optional(),
  blockedColumns: z.array(SQLIdentifierSchema).optional(),
  description: z.string().max(500).optional(),
});

const PermissionsConfigSchema = z.object({
  defaultAccess: AccessLevelSchema,
  tables: z.array(TablePermissionSchema).max(1000),
});

export type TablePermissionAPI = z.infer<typeof TablePermissionSchema>;
export type PermissionsConfigAPI = z.infer<typeof PermissionsConfigSchema>;

// In-memory store (in production, use database or Redis)
let permissionsConfig: PermissionsConfigAPI = {
  defaultAccess: 'read',
  tables: [],
};

/**
 * GET /api/permissions - Get current permissions config
 */
export async function GET() {
  return NextResponse.json(permissionsConfig);
}

/**
 * POST /api/permissions - Update permissions config
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parseResult = PermissionsConfigSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid permissions config',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    permissionsConfig = parseResult.data;

    // Permissions are now passed directly in each chat request
    // No need to update the analyst here

    return NextResponse.json({ success: true, config: permissionsConfig });
  } catch (error) {
    console.error('Failed to update permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update permissions' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/permissions - Update a single table permission
 */
export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parseResult = TablePermissionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid table permission',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const permission = parseResult.data;

    const existingIndex = permissionsConfig.tables.findIndex(
      t => t.table === permission.table && t.schema === permission.schema
    );

    if (existingIndex >= 0) {
      permissionsConfig.tables[existingIndex] = permission;
    } else {
      permissionsConfig.tables.push(permission);
    }

    return NextResponse.json({ success: true, permission });
  } catch (error) {
    console.error('Failed to update table permission:', error);
    return NextResponse.json(
      { error: 'Failed to update table permission' },
      { status: 500 }
    );
  }
}

// Schema for DELETE request query params
const DeletePermissionSchema = z.object({
  table: SQLIdentifierSchema,
  schema: SQLIdentifierSchema.optional().default('public'),
});

/**
 * DELETE /api/permissions - Remove a table permission
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = {
      table: searchParams.get('table') || undefined,
      schema: searchParams.get('schema') || undefined,
    };

    const parseResult = DeletePermissionSchema.safeParse(rawParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          details: parseResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { table, schema } = parseResult.data;

    permissionsConfig.tables = permissionsConfig.tables.filter(
      t => !(t.table === table && t.schema === schema)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete table permission:', error);
    return NextResponse.json(
      { error: 'Failed to delete table permission' },
      { status: 500 }
    );
  }
}
