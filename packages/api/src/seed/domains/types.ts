export interface ColumnDef {
  name: string;
  dataType: string;
  comment: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  isPii?: boolean;
  sampleValues?: string[];
  referencesTable?: string;
  referencesColumn?: string;
}

export interface TableDef {
  name: string;
  comment: string;
  layer: 'ods' | 'dwd' | 'dws' | 'ads';
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

export interface KnowledgeDocDef {
  title: string;
  content: string;
  docType: 'glossary' | 'template' | 'document';
}

export interface ConversationDef {
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    confidence?: number;
  }>;
}

export interface QueryHistoryDef {
  naturalLanguage: string;
  generatedSql: string;
  status: 'accepted' | 'pending' | 'rejected';
  isGolden: boolean;
  tablesUsed?: string[];
}

export interface DomainDefinition {
  name: string;
  description: string;
  dialect: string;
  tables: TableDef[];
  metrics: MetricDef[];
  glossary: GlossaryDef[];
  knowledgeDocs: KnowledgeDocDef[];
  conversations: ConversationDef[];
  queryHistory: QueryHistoryDef[];
}
