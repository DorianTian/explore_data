export interface ColumnDef {
  name: string;
  dataType: string;
  comment: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  isPii?: boolean;
  sampleValues?: string[];
  referencesTable?: string;
  referencesColumn?: string;
}

export interface TableDef {
  name: string;
  comment: string;
  layer: 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
  domain: 'trade' | 'user' | 'product' | 'risk';
  columns: ColumnDef[];
}

export interface MetricDef {
  name: string;
  displayName: string;
  expression: string;
  metricType: 'atomic' | 'derived' | 'composite';
  sourceTable: string;
  filters?: Array<{ column: string; op: string; value: string }>;
  dimensions?: string[];
  granularity?: string[];
  format?: 'number' | 'percentage' | 'currency';
  description?: string;
}

export interface GlossaryDef {
  term: string;
  sqlExpression: string;
  description: string;
}

export interface EngineSeedDefinition {
  engineType: 'hive' | 'iceberg' | 'spark' | 'mysql' | 'doris';
  name: string;
  description: string;
  dialect: string;
  pgSchema: string;
  tables: TableDef[];
  metrics: MetricDef[];
  glossary: GlossaryDef[];
}
