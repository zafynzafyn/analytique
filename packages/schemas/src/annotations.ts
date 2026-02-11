export interface ColumnAnnotation {
  description?: string;
  businessName?: string;
  examples?: string[];
  tags?: string[];
}

export interface TableAnnotation {
  description?: string;
  businessName?: string;
  tags?: string[];
  columns: Record<string, ColumnAnnotation>;
}

export interface AnnotationData {
  tables: Record<string, TableAnnotation>;
  updatedAt: string;
}

export class AnnotationStore {
  private data: AnnotationData;
  private storageKey: string;

  constructor(storageKey: string = 'analytique_annotations') {
    this.storageKey = storageKey;
    this.data = {
      tables: {},
      updatedAt: new Date().toISOString(),
    };
  }

  load(serialized: string): void {
    try {
      this.data = JSON.parse(serialized);
    } catch {
      this.data = { tables: {}, updatedAt: new Date().toISOString() };
    }
  }

  serialize(): string {
    return JSON.stringify(this.data);
  }

  getTableAnnotation(tableName: string): TableAnnotation | undefined {
    return this.data.tables[tableName];
  }

  setTableAnnotation(tableName: string, annotation: Partial<TableAnnotation>): void {
    const existing = this.data.tables[tableName] || { columns: {} };
    this.data.tables[tableName] = {
      ...existing,
      ...annotation,
      columns: {
        ...existing.columns,
        ...(annotation.columns || {}),
      },
    };
    this.data.updatedAt = new Date().toISOString();
  }

  getColumnAnnotation(tableName: string, columnName: string): ColumnAnnotation | undefined {
    return this.data.tables[tableName]?.columns[columnName];
  }

  setColumnAnnotation(
    tableName: string,
    columnName: string,
    annotation: ColumnAnnotation
  ): void {
    if (!this.data.tables[tableName]) {
      this.data.tables[tableName] = { columns: {} };
    }
    this.data.tables[tableName].columns[columnName] = annotation;
    this.data.updatedAt = new Date().toISOString();
  }

  getAllAnnotations(): AnnotationData {
    return { ...this.data };
  }

  getAnnotationsForContext(): string {
    const lines: string[] = [];

    for (const [tableName, table] of Object.entries(this.data.tables)) {
      if (table.description || table.businessName) {
        lines.push(`Table "${tableName}": ${table.businessName || ''} - ${table.description || ''}`);
      }

      for (const [columnName, column] of Object.entries(table.columns)) {
        if (column.description || column.businessName) {
          lines.push(
            `  Column "${tableName}.${columnName}": ${column.businessName || ''} - ${column.description || ''}`
          );
        }
      }
    }

    return lines.join('\n');
  }

  clear(): void {
    this.data = {
      tables: {},
      updatedAt: new Date().toISOString(),
    };
  }
}
