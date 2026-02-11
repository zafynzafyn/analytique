import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TableInfo {
  name: string;
  schema: string;
  rowCount?: number;
}

interface ColumnInfo {
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

async function executeQuery(
  url: string,
  key: string,
  query: string
): Promise<{ data: Record<string, unknown>[] | null; error: Error | null }> {
  try {
    // Create a fresh client for each query to avoid caching
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc('execute_readonly_query', {
      query_text: query,
    } as Record<string, unknown>);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const resultData = Array.isArray(data) ? data : data ? [data] : [];
    return { data: resultData as Record<string, unknown>[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('RPC not available') };
  }
}

export async function GET(request: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return Response.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const reqUrl = new URL(request.url);
    const tableName = reqUrl.searchParams.get('table');
    const schema = reqUrl.searchParams.get('schema') || 'public';

    // Response headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    };

    if (tableName) {
      // Get columns for a specific table
      const columnsQuery = `SELECT c.column_name as name, c.data_type as type, (c.is_nullable = 'YES') as nullable, c.column_default as default_value FROM information_schema.columns c WHERE c.table_name = '${tableName}' AND c.table_schema = '${schema}' ORDER BY c.ordinal_position`;

      const { data: columns, error: columnsError } = await executeQuery(url, key, columnsQuery);

      if (columnsError || !columns) {
        return Response.json({
          table: tableName,
          schema,
          columns: [],
          error: `Could not fetch columns: ${columnsError?.message}`,
        }, { headers });
      }

      // Get primary keys
      const pkQuery = `SELECT ccu.column_name FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name WHERE tc.table_name = '${tableName}' AND tc.table_schema = '${schema}' AND tc.constraint_type = 'PRIMARY KEY'`;
      const { data: pks } = await executeQuery(url, key, pkQuery);
      const pkColumns = new Set((pks || []).map((pk) => pk.column_name));

      // Get foreign keys
      const fkQuery = `SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${tableName}' AND tc.table_schema = '${schema}'`;
      const { data: fks } = await executeQuery(url, key, fkQuery);

      const columnInfos: ColumnInfo[] = columns.map((col: Record<string, unknown>) => {
        const fk = fks?.find((f: Record<string, unknown>) => f.column_name === col.name);
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

      return Response.json({ table: tableName, schema, columns: columnInfos }, { headers });
    }

    // List all tables
    const tablesQuery = `SELECT table_name as name, table_schema as schema FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    const { data: tables, error: tablesError } = await executeQuery(url, key, tablesQuery);

    if (tablesError || !tables) {
      return Response.json({
        tables: [],
        error: `Could not fetch tables: ${tablesError?.message}`,
      }, { headers });
    }

    const tableInfos: TableInfo[] = tables.map((t: Record<string, unknown>) => ({
      name: t.name as string,
      schema: t.schema as string,
    }));

    return Response.json({ tables: tableInfos }, { headers });
  } catch (error) {
    console.error('Schema API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
