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
  /** Raw DDL string — used when schema comes from agent tool calls as pre-formatted DDL */
  rawDdl?: string;
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

/** Detail payload for rich SSE progress events */
export interface StepDetail {
  thinking?: string;
  data?: unknown;
}

/** Progress callback for streaming pipeline status to the client */
export type ProgressCallback = (step: string, message: string, detail?: StepDetail) => void;

/** Token callback for streaming LLM output character-by-character */
export type TokenCallback = (token: string) => void;

export interface PipelineInput {
  projectId: string;
  datasourceId: string;
  userQuery: string;
  conversationHistory?: ConversationTurn[];
  dialect?: string;
  /** Optional callback invoked at each pipeline stage for progress reporting */
  onProgress?: ProgressCallback;
  /** Optional callback invoked for each LLM text delta during SQL generation */
  onToken?: TokenCallback;
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

// ---------------------------------------------------------------------------
// Verification Loop types
// ---------------------------------------------------------------------------

export interface VerificationDimension {
  name: string;
  weight: number;
  score: number;
  issues: string[];
}

export interface VerificationScore {
  total: number;
  dimensions: VerificationDimension[];
  passed: boolean;
}

export interface VerificationRound {
  round: number;
  sql: string;
  score: VerificationScore;
  staticIssues: string[];
  semanticIssues: string[];
  suggestedFix?: string;
}

// ---------------------------------------------------------------------------
// Chart types
// ---------------------------------------------------------------------------

export type ChartType =
  | 'metric_card'
  | 'line'
  | 'bar'
  | 'horizontal_bar'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'grouped_bar'
  | 'table';

export interface ChartConfig {
  chartType: ChartType;
  title: string;
  xField?: string;
  yField?: string[];
  categoryField?: string;
  valueField?: string;
  series?: Array<{ name: string; field: string; type?: string }>;
  sort?: 'asc' | 'desc';
  limit?: number;
  stacked?: boolean;
}
