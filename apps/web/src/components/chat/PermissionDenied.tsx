'use client';

import { ShieldAlert, Settings, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

interface PermissionDeniedProps {
  tables: string[];
  message: string;
  suggestion: string;
}

export function PermissionDenied({ tables, message, suggestion }: PermissionDeniedProps) {
  return (
    <Card className="p-4 border-destructive/50 bg-destructive/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-destructive/10">
          <ShieldAlert className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-destructive mb-1">Access Denied</h4>
          <p className="text-sm text-muted-foreground mb-3">{message}</p>

          {tables.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Restricted Tables:</p>
              <div className="flex flex-wrap gap-1">
                {tables.map((table) => (
                  <span
                    key={table}
                    className="px-2 py-0.5 text-xs font-mono bg-destructive/10 text-destructive rounded"
                  >
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-4">{suggestion}</p>

          <div className="flex flex-wrap gap-2">
            <Link href="/settings">
              <Button size="sm" variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Go to Security Settings
              </Button>
            </Link>
            <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Request Access
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
