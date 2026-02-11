import { NextRequest, NextResponse } from 'next/server';

type AccessLevel = 'full' | 'read' | 'none';

// Import the permissions config from parent route
// In production, this would come from a database
let permissionsConfig: {
  defaultAccess: AccessLevel;
  tables: Array<{
    table: string;
    schema: string;
    accessLevel: AccessLevel;
  }>;
} = {
  defaultAccess: 'read',
  tables: [],
};

// Simple SQL table extractor
function extractTablesFromSQL(sql: string): string[] {
  const tables: string[] = [];
  const normalizedSQL = sql.replace(/\s+/g, ' ').toLowerCase();

  // Match FROM clause tables
  const fromRegex = /\bfrom\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
  let match;
  while ((match = fromRegex.exec(normalizedSQL)) !== null) {
    const tableName = match[1].split('.').pop();
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  // Match JOIN clause tables
  const joinRegex = /\bjoin\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
  while ((match = joinRegex.exec(normalizedSQL)) !== null) {
    const tableName = match[1].split('.').pop();
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  return tables;
}

function canAccessTable(tableName: string, schema: string = 'public'): boolean {
  const permission = permissionsConfig.tables.find(
    t => t.table === tableName && t.schema === schema
  );

  if (permission) {
    return permission.accessLevel !== 'none';
  }

  return permissionsConfig.defaultAccess !== 'none';
}

/**
 * POST /api/permissions/validate - Validate SQL query against permissions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sql } = body;

    if (!sql) {
      return NextResponse.json(
        { error: 'sql is required' },
        { status: 400 }
      );
    }

    const tables = extractTablesFromSQL(sql);
    const blockedTables: string[] = [];

    for (const table of tables) {
      if (!canAccessTable(table)) {
        blockedTables.push(table);
      }
    }

    const allowed = blockedTables.length === 0;

    return NextResponse.json({
      allowed,
      tables,
      blockedTables,
      message: allowed
        ? 'Query is allowed'
        : `Access denied to table(s): ${blockedTables.join(', ')}`,
    });
  } catch (error) {
    console.error('Failed to validate SQL:', error);
    return NextResponse.json(
      { error: 'Failed to validate SQL' },
      { status: 500 }
    );
  }
}

// Export function to update permissions from the main permissions route
export function updatePermissionsConfig(config: typeof permissionsConfig) {
  permissionsConfig = config;
}
