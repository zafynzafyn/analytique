-- Analytique: Supabase Setup Script
-- Run this SQL in your Supabase SQL Editor to enable the AI analyst functionality

-- Function to execute read-only SQL queries
-- This is used by the agent to run SELECT queries against your database
CREATE OR REPLACE FUNCTION execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Validate that the query is read-only
    IF query_text !~* '^\s*(SELECT|WITH)\s' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Check for dangerous keywords
    IF query_text ~* '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXECUTE|EXEC)\b' THEN
        RAISE EXCEPTION 'Modification queries are not allowed';
    END IF;

    -- Execute the query and return results as JSON
    EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
    INTO result;

    RETURN result;
END;
$$;

-- Function to get table information (alternative to information_schema queries)
CREATE OR REPLACE FUNCTION get_tables_info(schema_name TEXT DEFAULT 'public')
RETURNS TABLE(
    name TEXT,
    schema_name TEXT,
    column_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        t.table_name::TEXT as name,
        t.table_schema::TEXT as schema_name,
        (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_name = t.table_name AND c.table_schema = t.table_schema) as column_count
    FROM information_schema.tables t
    WHERE t.table_schema = schema_name
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
$$;

-- Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION execute_readonly_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_readonly_query(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_tables_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_info(TEXT) TO anon;

-- Note: For production use, consider adding:
-- 1. Rate limiting (using Supabase Edge Functions or pg_stat_statements)
-- 2. Query timeout limits (SET statement_timeout = '30s' in the function)
-- 3. Result row limits (add LIMIT clause enforcement)
-- 4. Audit logging (insert into an audit table)
