/** Skill execution result */
export interface SkillResult {
  success: boolean;
  data: unknown;
  error?: string;
}

/** Tool definition for Claude tool_use API */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Query complexity level — determines routing strategy */
export type QueryComplexity = 'simple' | 'moderate' | 'complex';

/** Enhanced intent classification with complexity routing */
export interface ClassificationResult {
  type: 'sql_query' | 'follow_up' | 'clarification' | 'off_topic';
  complexity: QueryComplexity;
  confidence: number;
  modificationHint?: string;
  reason: string;
}
