export type IntentType = 'sql_query' | 'follow_up' | 'clarification' | 'off_topic';

export interface IntentResult {
  type: IntentType;
  confidence: number;
  /** For follow_up — what aspect of the previous query to modify */
  modificationHint?: string;
}

export interface SchemaContext {
  tables: Array<{
    name: string;
    comment: string | null;
    columns: Array<{
      name: string;
      dataType: string;
      comment: string | null;
      sampleValues: string[] | null;
      isPrimaryKey: boolean;
    }>;
  }>;
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }>;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
}

export interface GenerationContext {
  userQuery: string;
  schema: SchemaContext;
  glossary: Array<{ term: string; sqlExpression: string }>;
  knowledgeContext: string[];
  conversationHistory: ConversationTurn[];
  fewShotExamples: Array<{ question: string; sql: string }>;
  dialect: string;
}

export interface GenerationResult {
  sql: string;
  explanation: string;
  confidence: number;
  tablesUsed: string[];
  columnsUsed: string[];
}

export interface PipelineInput {
  projectId: string;
  datasourceId: string;
  userQuery: string;
  conversationHistory?: ConversationTurn[];
  dialect?: string;
}

export interface PipelineResult {
  /** Whether the query was resolved via metric composition or full NL2SQL */
  resolvedVia: 'metric' | 'nl2sql' | 'clarification';
  sql?: string;
  explanation: string;
  confidence: number;
  tablesUsed?: string[];
  /** If clarification is needed, the question to ask the user */
  clarificationQuestion?: string;
}
