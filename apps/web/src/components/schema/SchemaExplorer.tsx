'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  Database,
  Table,
  Key,
  Link2,
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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

interface TableSchema {
  table: string;
  schema: string;
  columns: ColumnInfo[];
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export function SchemaExplorer() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: tablesData,
    error: tablesError,
    isLoading: tablesLoading,
  } = useSWR<{ tables: TableInfo[]; error?: string }>(
    `/api/schema?_t=${refreshKey}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const {
    data: tableSchema,
    error: schemaError,
    isLoading: schemaLoading,
  } = useSWR<TableSchema>(
    selectedTable ? `/api/schema?table=${selectedTable}&_t=${refreshKey}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    // The loading state from SWR will handle the rest
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const tables = tablesData?.tables || [];
  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Table List */}
      <div className="w-72 border-r bg-card/50 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <h2 className="font-semibold">Tables</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing || tablesLoading}
              title="Refresh tables"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  (isRefreshing || tablesLoading) && 'animate-spin'
                )}
              />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {tablesLoading ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : tablesError || tablesData?.error ? (
            <div className="p-4 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {tablesData?.error || 'Failed to load tables'}
              </p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {searchQuery ? 'No tables match your search' : 'No tables found'}
            </div>
          ) : (
            <div className="p-2">
              {filteredTables.map((table) => (
                <Button
                  key={table.name}
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-2 mb-1',
                    selectedTable === table.name && 'bg-accent'
                  )}
                  onClick={() => setSelectedTable(table.name)}
                >
                  <Table className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{table.name}</span>
                  <ChevronRight className="h-4 w-4 ml-auto flex-shrink-0" />
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Content - Table Details */}
      <div className="flex-1 p-6 overflow-auto">
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a table</h3>
            <p className="text-muted-foreground text-sm">
              Choose a table from the sidebar to view its schema
            </p>
          </div>
        ) : schemaLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Loading schema...</p>
          </div>
        ) : schemaError ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-muted-foreground">Failed to load table schema</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Table className="h-6 w-6" />
                {selectedTable}
              </h2>
              <p className="text-muted-foreground mt-1">
                {tableSchema?.columns.length || 0} columns
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Columns</h3>

              <div className="grid gap-3">
                {tableSchema?.columns.map((column) => (
                  <Card key={column.name}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {column.isPrimaryKey && (
                            <Key className="h-4 w-4 text-yellow-500" />
                          )}
                          {column.isForeignKey && (
                            <Link2 className="h-4 w-4 text-blue-500" />
                          )}
                          <span className="font-medium">{column.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{column.type}</Badge>
                          {column.nullable && (
                            <Badge variant="outline">nullable</Badge>
                          )}
                        </div>
                      </div>

                      {column.references && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          References {column.references.table}.{column.references.column}
                        </div>
                      )}

                      {column.defaultValue && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Default: <code className="bg-muted px-1 rounded">{column.defaultValue}</code>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
