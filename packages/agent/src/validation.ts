export interface SQLValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

const BLOCKED_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'EXEC',
  'CALL',
];

const WARNING_KEYWORDS = [
  'TRUNCATE',
  'CASCADE',
  'FORCE',
];

export function validateSQL(sql: string): SQLValidationResult {
  const normalizedSQL = sql.toUpperCase().trim();
  const warnings: string[] = [];

  // Check for blocked DDL/DML statements
  for (const keyword of BLOCKED_KEYWORDS) {
    // Match keyword at start of statement or after semicolon
    const pattern = new RegExp(`(^|;\\s*)${keyword}\\b`, 'i');
    if (pattern.test(normalizedSQL)) {
      return {
        valid: false,
        error: `SQL contains blocked keyword: ${keyword}. Only SELECT queries are allowed.`,
      };
    }
  }

  // Check for potential SQL injection patterns
  if (normalizedSQL.includes('--') && normalizedSQL.indexOf('--') > 0) {
    warnings.push('SQL contains comment syntax which may indicate injection attempt');
  }

  if (normalizedSQL.includes(';') && normalizedSQL.indexOf(';') < normalizedSQL.length - 1) {
    return {
      valid: false,
      error: 'Multiple SQL statements are not allowed',
    };
  }

  // Check for SELECT statement
  if (!normalizedSQL.startsWith('SELECT') && !normalizedSQL.startsWith('WITH')) {
    return {
      valid: false,
      error: 'Query must start with SELECT or WITH (CTE)',
    };
  }

  // Check for warning keywords in subqueries or CTEs
  for (const keyword of WARNING_KEYWORDS) {
    if (normalizedSQL.includes(keyword)) {
      warnings.push(`Query contains '${keyword}' which may indicate risky operation`);
    }
  }

  // Check for potential performance issues
  if (!normalizedSQL.includes('LIMIT') && !normalizedSQL.includes('TOP')) {
    warnings.push('Query has no LIMIT clause. Consider adding one for large tables.');
  }

  if (normalizedSQL.includes('SELECT *')) {
    warnings.push('Using SELECT * may return more data than needed');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function sanitizeSQL(sql: string): string {
  // Remove any trailing semicolons
  let sanitized = sql.trim();
  while (sanitized.endsWith(';')) {
    sanitized = sanitized.slice(0, -1).trim();
  }
  return sanitized;
}

export function addDefaultLimit(sql: string, limit: number = 1000): string {
  const upperSQL = sql.toUpperCase();
  if (!upperSQL.includes('LIMIT')) {
    return `${sql} LIMIT ${limit}`;
  }
  return sql;
}
