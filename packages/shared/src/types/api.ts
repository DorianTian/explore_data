export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface DdlParseResult {
  tableName: string;
  comment: string | null;
  columns: Array<{
    name: string;
    dataType: string;
    comment: string | null;
    isPrimaryKey: boolean;
    isNullable: boolean;
  }>;
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}
