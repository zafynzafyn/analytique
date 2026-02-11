'use client';

import { useState, useEffect } from 'react';
import { Shield, Table, Lock, Unlock, Eye, EyeOff, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  type AccessLevel,
  type TablePermission,
  type TablePermissionsConfig,
  loadTablePermissions,
  saveTablePermissions,
  updateTablePermission,
  getAccessLevelDescription,
  isSensitiveColumn,
} from '@/lib/table-permissions';

interface SchemaTable {
  table: string;
  schema: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }>;
}

export default function SettingsPage() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [permissions, setPermissions] = useState<TablePermissionsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load schema and permissions on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load tables list
        const schemaRes = await fetch('/api/schema');
        if (schemaRes.ok) {
          const schemaData = await schemaRes.json();
          const tablesList = schemaData.tables || [];

          // Load columns for each table
          const tablesWithColumns = await Promise.all(
            tablesList.map(async (t: { name: string; schema: string }) => {
              const colRes = await fetch(`/api/schema?table=${t.name}&schema=${t.schema}`);
              if (colRes.ok) {
                const colData = await colRes.json();
                return {
                  table: t.name,
                  schema: t.schema,
                  columns: colData.columns || [],
                };
              }
              return { table: t.name, schema: t.schema, columns: [] };
            })
          );

          setTables(tablesWithColumns);
        }

        // Load permissions from localStorage
        const storedPermissions = loadTablePermissions();
        setPermissions(storedPermissions);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleDefaultAccessChange = (value: AccessLevel) => {
    if (!permissions) return;
    setPermissions({
      ...permissions,
      defaultAccess: value,
      updatedAt: new Date(),
    });
    setHasChanges(true);
  };

  const handleTableAccessChange = (tableName: string, schema: string, accessLevel: AccessLevel) => {
    if (!permissions) return;

    const existingPermission = permissions.tables.find(
      t => t.table === tableName && t.schema === schema
    );

    const newPermission: TablePermission = {
      table: tableName,
      schema,
      accessLevel,
      blockedColumns: existingPermission?.blockedColumns || [],
      allowedColumns: existingPermission?.allowedColumns,
    };

    setPermissions(updateTablePermission(permissions, newPermission));
    setHasChanges(true);
  };

  const handleColumnToggle = (tableName: string, schema: string, columnName: string) => {
    if (!permissions) return;

    const existingPermission = permissions.tables.find(
      t => t.table === tableName && t.schema === schema
    );

    const blockedColumns = existingPermission?.blockedColumns || [];
    const isBlocked = blockedColumns.includes(columnName);

    const newBlockedColumns = isBlocked
      ? blockedColumns.filter(c => c !== columnName)
      : [...blockedColumns, columnName];

    const newPermission: TablePermission = {
      table: tableName,
      schema,
      accessLevel: existingPermission?.accessLevel || permissions.defaultAccess,
      blockedColumns: newBlockedColumns,
    };

    setPermissions(updateTablePermission(permissions, newPermission));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!permissions) return;
    setIsSaving(true);

    try {
      // Save to localStorage
      saveTablePermissions(permissions);

      // Also sync to API for server-side validation
      await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissions),
      });

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save permissions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getTablePermission = (tableName: string, schema: string): TablePermission => {
    if (!permissions) {
      return { table: tableName, schema, accessLevel: 'read' };
    }

    const existing = permissions.tables.find(
      t => t.table === tableName && t.schema === schema
    );

    return existing || { table: tableName, schema, accessLevel: permissions.defaultAccess };
  };

  const getAccessBadge = (level: AccessLevel) => {
    switch (level) {
      case 'full':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Full Access</Badge>;
      case 'read':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Read Only</Badge>;
      case 'none':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">No Access</Badge>;
    }
  };

  const selectedTableData = selectedTable
    ? tables.find(t => `${t.schema}.${t.table}` === selectedTable)
    : null;

  const selectedPermission = selectedTableData
    ? getTablePermission(selectedTableData.table, selectedTableData.schema)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Table Security</h1>
            <p className="text-sm text-muted-foreground">
              Control which tables and columns the AI can access
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Table List */}
        <div className="w-80 border-r bg-muted/30 flex flex-col">
          {/* Default Access */}
          <div className="p-4 border-b">
            <label className="text-sm font-medium mb-2 block">Default Access Level</label>
            <select
              value={permissions?.defaultAccess || 'read'}
              onChange={(e) => handleDefaultAccessChange(e.target.value as AccessLevel)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="full">Full Access</option>
              <option value="read">Read Only</option>
              <option value="none">No Access</option>
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              {getAccessLevelDescription(permissions?.defaultAccess || 'read')}
            </p>
          </div>

          {/* Table List */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                TABLES ({tables.length})
              </div>
              {tables.map((table) => {
                const permission = getTablePermission(table.table, table.schema);
                const isSelected = selectedTable === `${table.schema}.${table.table}`;
                const hasCustomPermission = permissions?.tables.some(
                  t => t.table === table.table && t.schema === table.schema
                );

                return (
                  <button
                    key={`${table.schema}.${table.table}`}
                    onClick={() => setSelectedTable(`${table.schema}.${table.table}`)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Table className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate text-sm">{table.table}</span>
                      {hasCustomPermission && (
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {permission.accessLevel === 'none' ? (
                        <Lock className="h-3.5 w-3.5 text-red-500" />
                      ) : permission.accessLevel === 'full' ? (
                        <Unlock className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Table Details */}
        <div className="flex-1 overflow-auto">
          {selectedTableData && selectedPermission ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Table className="h-5 w-5" />
                    {selectedTableData.table}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Schema: {selectedTableData.schema} • {selectedTableData.columns.length} columns
                  </p>
                </div>
                {getAccessBadge(selectedPermission.accessLevel)}
              </div>

              {/* Access Level */}
              <Card className="p-4 mb-6">
                <label className="text-sm font-medium mb-2 block">Access Level</label>
                <select
                  value={selectedPermission.accessLevel}
                  onChange={(e) =>
                    handleTableAccessChange(
                      selectedTableData.table,
                      selectedTableData.schema,
                      e.target.value as AccessLevel
                    )
                  }
                  className="w-[200px] h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="full">Full Access</option>
                  <option value="read">Read Only</option>
                  <option value="none">No Access</option>
                </select>
              </Card>

              {/* Column Permissions */}
              {selectedPermission.accessLevel !== 'none' && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium">Column Access</h3>
                      <p className="text-sm text-muted-foreground">
                        Toggle visibility for individual columns
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {selectedTableData.columns.map((column) => {
                      const isBlocked = selectedPermission.blockedColumns?.includes(column.name);
                      const isSensitive = isSensitiveColumn(column.name);

                      return (
                        <div
                          key={column.name}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 rounded-lg',
                            isBlocked ? 'bg-red-500/5' : 'hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                handleColumnToggle(
                                  selectedTableData.table,
                                  selectedTableData.schema,
                                  column.name
                                )
                              }
                              className={cn(
                                'p-1.5 rounded transition-colors',
                                isBlocked
                                  ? 'bg-red-500/10 text-red-500'
                                  : 'bg-green-500/10 text-green-500'
                              )}
                            >
                              {isBlocked ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={cn('font-mono text-sm', isBlocked && 'line-through text-muted-foreground')}>
                                  {column.name}
                                </span>
                                {column.isPrimaryKey && (
                                  <Badge variant="outline" className="text-xs">PK</Badge>
                                )}
                                {column.isForeignKey && (
                                  <Badge variant="outline" className="text-xs">FK</Badge>
                                )}
                                {isSensitive && (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Sensitive
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {column.type}
                                {!column.nullable && ' • NOT NULL'}
                              </span>
                            </div>
                          </div>
                          <span className={cn(
                            'text-xs',
                            isBlocked ? 'text-red-500' : 'text-green-500'
                          )}>
                            {isBlocked ? 'Hidden' : 'Visible'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Select a table to configure its security settings</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
