import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { validateSQL, sanitizeSQL, addDefaultLimit } from './validation';

/**
 * Escapes a string for safe use in SQL queries.
 * Prevents SQL injection by escaping single quotes and backslashes.
 */
function escapeSQLString(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string value for SQL escape');
  }
  // Escape backslashes first, then single quotes
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Validates that a value is a safe SQL identifier (table name, schema name, column name).
 * Only allows alphanumeric characters and underscores.
 */
function isValidSQLIdentifier(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    return false;
  }
  // Only allow alphanumeric, underscore, and must start with letter or underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

/**
 * Validates and sanitizes a SQL identifier, throwing if invalid.
 */
function validateSQLIdentifier(value: string, identifierType: string): string {
  if (!isValidSQLIdentifier(value)) {
    throw new Error(
      `Invalid ${identifierType}: "${value}". ` +
      `Identifiers must contain only letters, numbers, and underscores, and start with a letter or underscore.`
    );
  }
  return value;
}

export type AccessLevel = 'full' | 'read' | 'none';

export interface TablePermission {
  table: string;
  schema: string;
  accessLevel: AccessLevel;
  blockedColumns?: string[];
}

export interface TablePermissionsConfig {
  defaultAccess: AccessLevel;
  tables: TablePermission[];
}

export interface SupabaseToolsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  queryTimeout?: number;
  maxRows?: number;
  permissions?: TablePermissionsConfig;
}

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface QueryResult {
  data: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  executionTime: number;
}

export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'list_tables',
    description:
      'List all tables in the database with their column counts. Use this first to understand what data is available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        schema: {
          type: 'string',
          description: 'Database schema to list tables from. Defaults to "public".',
          default: 'public',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_table_schema',
    description:
      'Get detailed schema information for a specific table including columns, types, and relationships.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: 'Name of the table to get schema for',
        },
        schema: {
          type: 'string',
          description: 'Database schema. Defaults to "public".',
          default: 'public',
        },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'execute_sql',
    description:
      'Execute a read-only SQL query and return results. Only SELECT queries are allowed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'The SQL query to execute. Must be a SELECT statement.',
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional parameters for parameterized queries',
        },
      },
      required: ['sql'],
    },
  },
];

export function createSupabaseTools(config: SupabaseToolsConfig) {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);
  const queryTimeout = config.queryTimeout ?? 30000;
  const maxRows = config.maxRows ?? 1000;
  const permissions = config.permissions ?? { defaultAccess: 'read', tables: [] };

  // Log permissions for debugging
  console.log('[Permissions Config]', JSON.stringify(permissions, null, 2));

  // Permission helper functions
  function getTablePermission(tableName: string, schema: string = 'public'): TablePermission {
    // Case-insensitive comparison for table names
    const lowerTableName = tableName.toLowerCase();
    const lowerSchema = schema.toLowerCase();
    const explicit = permissions.tables.find(
      (t) => t.table.toLowerCase() === lowerTableName && t.schema.toLowerCase() === lowerSchema
    );
    return explicit ?? { table: tableName, schema, accessLevel: permissions.defaultAccess };
  }

  function canAccessTable(tableName: string, schema: string = 'public'): boolean {
    const perm = getTablePermission(tableName, schema);
    console.log(`[Permission Check] Table: ${tableName}, Access Level: ${perm.accessLevel}`);
    return perm.accessLevel !== 'none';
  }

  function extractTablesFromSQL(sql: string): string[] {
    const tables: string[] = [];
    const normalizedSQL = sql.replace(/\s+/g, ' ').toLowerCase();

    // Match FROM clause tables
    const fromRegex = /\bfrom\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
    let match;
    while ((match = fromRegex.exec(sql)) !== null) {
      const tableName = match[1].split('.').pop()?.toLowerCase();
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }

    // Match JOIN clause tables
    const joinRegex = /\bjoin\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi;
    while ((match = joinRegex.exec(sql)) !== null) {
      const tableName = match[1].split('.').pop()?.toLowerCase();
      if (tableName && !tables.includes(tableName)) {
        tables.push(tableName);
      }
    }

    return tables;
  }

  function validateTableAccess(sql: string): { allowed: boolean; blockedTables: string[] } {
    const tables = extractTablesFromSQL(sql);
    console.log(`[SQL Tables Extracted] ${tables.join(', ')}`);
    const blockedTables = tables.filter((t) => !canAccessTable(t));
    if (blockedTables.length > 0) {
      console.log(`[ACCESS BLOCKED] Tables: ${blockedTables.join(', ')}`);
    }
    return { allowed: blockedTables.length === 0, blockedTables };
  }

  async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.rpc('execute_readonly_query', {
      query_text: sql,
    } as Record<string, unknown>);

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async function listTables(schema: string = 'public'): Promise<TableInfo[]> {
    // Validate schema name to prevent SQL injection
    const safeSchema = validateSQLIdentifier(schema, 'schema name');
    const sql = `SELECT table_name as name, table_schema as schema FROM information_schema.tables WHERE table_schema = '${escapeSQLString(safeSchema)}' AND table_type = 'BASE TABLE' ORDER BY table_name`;

    try {
      const tables = await runQuery(sql);
      console.log(`[listTables] Found ${tables.length} tables in schema '${schema}'`);

      // Filter tables based on permissions
      const accessibleTables = tables.filter((t) => {
        const accessible = canAccessTable(t.name as string, t.schema as string);
        if (!accessible) {
          console.log(`[listTables] Hiding restricted table: ${t.name}`);
        }
        return accessible;
      });

      console.log(`[listTables] Returning ${accessibleTables.length} accessible tables`);

      return accessibleTables.map((t) => ({
        name: t.name as string,
        schema: t.schema as string,
        columns: [],
      }));
    } catch (error) {
      console.error('listTables error:', error);
      return [];
    }
  }

  async function getTableSchema(tableName: string, schema: string = 'public'): Promise<TableInfo> {
    // Validate identifiers to prevent SQL injection
    const safeTableName = validateSQLIdentifier(tableName, 'table name');
    const safeSchema = validateSQLIdentifier(schema, 'schema name');

    // Check table access permission
    if (!canAccessTable(safeTableName, safeSchema)) {
      throw new Error(
        `ACCESS_DENIED: You don't have permission to access the table '${safeTableName}'. ` +
        `This table has been restricted in Security Settings. ` +
        `To access this data, please go to Security Settings to update table permissions, ` +
        `or contact your administrator to request access.`
      );
    }

    const tablePermission = getTablePermission(safeTableName, safeSchema);
    const blockedColumns = tablePermission.blockedColumns ?? [];

    // Get columns - using escaped strings for safety
    const escapedTableName = escapeSQLString(safeTableName);
    const escapedSchema = escapeSQLString(safeSchema);

    const columnsSQL = `SELECT c.column_name as name, c.data_type as type, (c.is_nullable = 'YES') as nullable, c.column_default as default_value FROM information_schema.columns c WHERE c.table_name = '${escapedTableName}' AND c.table_schema = '${escapedSchema}' ORDER BY c.ordinal_position`;
    const columnsData = await runQuery(columnsSQL);

    // Get primary keys
    const pkSQL = `SELECT ccu.column_name FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name = '${escapedTableName}' AND tc.table_schema = '${escapedSchema}' AND tc.constraint_type = 'PRIMARY KEY'`;
    const pkData = await runQuery(pkSQL);
    const pkColumns = new Set(pkData.map((pk) => pk.column_name));

    // Get foreign keys
    const fkSQL = `SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${escapedTableName}' AND tc.table_schema = '${escapedSchema}'`;
    const fkData = await runQuery(fkSQL);

    // Filter out blocked columns and map
    const columns: ColumnInfo[] = columnsData
      .filter((col) => !blockedColumns.includes(col.name as string))
      .map((col) => {
        const fk = fkData.find((f) => f.column_name === col.name);
        return {
          name: col.name as string,
          type: col.type as string,
          nullable: col.nullable as boolean,
          defaultValue: col.default_value as string | undefined,
          isPrimaryKey: pkColumns.has(col.name as string),
          isForeignKey: !!fk,
          references: fk
            ? { table: fk.foreign_table as string, column: fk.foreign_column as string }
            : undefined,
        };
      });

    return { name: safeTableName, schema: safeSchema, columns };
  }

  async function executeSQL(sql: string, _params?: string[]): Promise<QueryResult> {
    const validation = validateSQL(sql);
    if (!validation.valid) {
      throw new Error(`SQL validation failed: ${validation.error}`);
    }

    // Validate table access permissions
    const accessValidation = validateTableAccess(sql);
    if (!accessValidation.allowed) {
      const tableList = accessValidation.blockedTables.join(', ');
      throw new Error(
        `ACCESS_DENIED: You don't have permission to query the following table(s): ${tableList}. ` +
        `These tables have been restricted in Security Settings. ` +
        `To access this data, please go to Security Settings to update table permissions, ` +
        `or contact your administrator to request access.`
      );
    }

    const sanitizedSQL = sanitizeSQL(sql);
    const limitedSQL = addDefaultLimit(sanitizedSQL, maxRows);

    const startTime = Date.now();

    // Use a timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${queryTimeout}ms`)), queryTimeout);
    });

    const queryPromise = runQuery(limitedSQL);

    const data = await Promise.race([queryPromise, timeoutPromise]);
    const executionTime = Date.now() - startTime;
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return {
      data,
      rowCount: data.length,
      columns,
      executionTime,
    };
  }

  async function handleToolCall(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    try {
      switch (toolName) {
        case 'list_tables': {
          const schema = (toolInput.schema as string) || 'public';
          const tables = await listTables(schema);
          return JSON.stringify({
            success: true,
            tables: tables.map((t) => ({
              name: t.name,
              columnCount: t.columns.length,
            })),
          });
        }

        case 'get_table_schema': {
          const tableName = toolInput.table_name as string;
          const schema = (toolInput.schema as string) || 'public';
          const tableInfo = await getTableSchema(tableName, schema);
          return JSON.stringify({
            success: true,
            table: tableInfo,
          });
        }

        case 'execute_sql': {
          const sql = toolInput.sql as string;
          const params = toolInput.params as string[] | undefined;
          const result = await executeSQL(sql, params);
          return JSON.stringify({
            success: true,
            result: {
              data: result.data,
              rowCount: result.rowCount,
              columns: result.columns,
              executionTimeMs: result.executionTime,
            },
          });
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown tool: ${toolName}`,
          });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      return JSON.stringify({
        success: false,
        error: message,
      });
    }
  }

  return {
    definitions: TOOL_DEFINITIONS,
    handleToolCall,
    listTables,
    getTableSchema,
    executeSQL,
  };
}
