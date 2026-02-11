/**
 * Table-level access control system
 * Manages which tables can be queried by the AI analyst
 */

export type AccessLevel = 'full' | 'read' | 'none';

export interface TablePermission {
  table: string;
  schema: string;
  accessLevel: AccessLevel;
  allowedColumns?: string[]; // If set, only these columns can be accessed
  blockedColumns?: string[]; // Columns to exclude (e.g., sensitive data)
  description?: string; // Human-readable description
}

export interface TablePermissionsConfig {
  defaultAccess: AccessLevel;
  tables: TablePermission[];
  updatedAt: Date;
}

const STORAGE_KEY = 'analytique-table-permissions';

const DEFAULT_CONFIG: TablePermissionsConfig = {
  defaultAccess: 'read', // Default allows read access to all tables
  tables: [],
  updatedAt: new Date(),
};

/**
 * Load table permissions from localStorage
 */
export function loadTablePermissions(): TablePermissionsConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        updatedAt: new Date(parsed.updatedAt),
      };
    }
  } catch (e) {
    console.error('Failed to load table permissions:', e);
  }

  return DEFAULT_CONFIG;
}

/**
 * Save table permissions to localStorage
 */
export function saveTablePermissions(config: TablePermissionsConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...config,
      updatedAt: new Date(),
    }));
  } catch (e) {
    console.error('Failed to save table permissions:', e);
  }
}

/**
 * Get access level for a specific table
 */
export function getTableAccess(
  config: TablePermissionsConfig,
  tableName: string,
  schemaName: string = 'public'
): TablePermission | null {
  const permission = config.tables.find(
    t => t.table === tableName && t.schema === schemaName
  );

  if (permission) {
    return permission;
  }

  // Return default access level
  return {
    table: tableName,
    schema: schemaName,
    accessLevel: config.defaultAccess,
  };
}

/**
 * Check if a table can be accessed
 */
export function canAccessTable(
  config: TablePermissionsConfig,
  tableName: string,
  schemaName: string = 'public'
): boolean {
  const permission = getTableAccess(config, tableName, schemaName);
  return permission !== null && permission.accessLevel !== 'none';
}

/**
 * Check if a specific column can be accessed
 */
export function canAccessColumn(
  config: TablePermissionsConfig,
  tableName: string,
  columnName: string,
  schemaName: string = 'public'
): boolean {
  const permission = getTableAccess(config, tableName, schemaName);

  if (!permission || permission.accessLevel === 'none') {
    return false;
  }

  // Check blocked columns
  if (permission.blockedColumns?.includes(columnName)) {
    return false;
  }

  // Check allowed columns (if specified, only those are allowed)
  if (permission.allowedColumns && permission.allowedColumns.length > 0) {
    return permission.allowedColumns.includes(columnName);
  }

  return true;
}

/**
 * Filter tables based on permissions
 */
export function filterAccessibleTables(
  config: TablePermissionsConfig,
  tables: Array<{ table: string; schema: string }>
): Array<{ table: string; schema: string }> {
  return tables.filter(t => canAccessTable(config, t.table, t.schema));
}

/**
 * Filter columns based on permissions
 */
export function filterAccessibleColumns(
  config: TablePermissionsConfig,
  tableName: string,
  columns: string[],
  schemaName: string = 'public'
): string[] {
  return columns.filter(col => canAccessColumn(config, tableName, col, schemaName));
}

/**
 * Update permission for a single table
 */
export function updateTablePermission(
  config: TablePermissionsConfig,
  permission: TablePermission
): TablePermissionsConfig {
  const existingIndex = config.tables.findIndex(
    t => t.table === permission.table && t.schema === permission.schema
  );

  const newTables = [...config.tables];

  if (existingIndex >= 0) {
    newTables[existingIndex] = permission;
  } else {
    newTables.push(permission);
  }

  return {
    ...config,
    tables: newTables,
    updatedAt: new Date(),
  };
}

/**
 * Remove permission for a table (reverts to default)
 */
export function removeTablePermission(
  config: TablePermissionsConfig,
  tableName: string,
  schemaName: string = 'public'
): TablePermissionsConfig {
  return {
    ...config,
    tables: config.tables.filter(
      t => !(t.table === tableName && t.schema === schemaName)
    ),
    updatedAt: new Date(),
  };
}

/**
 * Extract table names from a SQL query (simple parser)
 */
export function extractTablesFromSQL(sql: string): string[] {
  const tables: string[] = [];

  // Normalize SQL
  const normalizedSQL = sql
    .replace(/\s+/g, ' ')
    .replace(/["'`]/g, '')
    .toLowerCase();

  // Match FROM clause tables
  const fromMatches = normalizedSQL.matchAll(/\bfrom\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of fromMatches) {
    const tableName = match[1].split('.').pop();
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  // Match JOIN clause tables
  const joinMatches = normalizedSQL.matchAll(/\bjoin\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?)/gi);
  for (const match of joinMatches) {
    const tableName = match[1].split('.').pop();
    if (tableName && !tables.includes(tableName)) {
      tables.push(tableName);
    }
  }

  return tables;
}

/**
 * Validate if a SQL query only accesses permitted tables
 */
export function validateSQLAccess(
  config: TablePermissionsConfig,
  sql: string
): { allowed: boolean; blockedTables: string[] } {
  const tables = extractTablesFromSQL(sql);
  const blockedTables: string[] = [];

  for (const table of tables) {
    if (!canAccessTable(config, table)) {
      blockedTables.push(table);
    }
  }

  return {
    allowed: blockedTables.length === 0,
    blockedTables,
  };
}

/**
 * Get human-readable description of access level
 */
export function getAccessLevelDescription(level: AccessLevel): string {
  switch (level) {
    case 'full':
      return 'Full access - All columns visible';
    case 'read':
      return 'Read access - Standard query access';
    case 'none':
      return 'No access - Table is hidden';
    default:
      return 'Unknown';
  }
}

/**
 * Commonly sensitive column patterns to suggest blocking
 */
export const SENSITIVE_COLUMN_PATTERNS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'private_key',
  'credit_card',
  'ssn',
  'social_security',
  'bank_account',
  'routing_number',
  'pin',
  'cvv',
  'auth',
  'credential',
];

/**
 * Check if a column name looks sensitive
 */
export function isSensitiveColumn(columnName: string): boolean {
  const lowerName = columnName.toLowerCase();
  return SENSITIVE_COLUMN_PATTERNS.some(pattern => lowerName.includes(pattern));
}
