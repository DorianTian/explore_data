import { eq } from 'drizzle-orm';
import { metrics, glossaryEntries, schemaTables, type DbClient } from '@nl2sql/db';
import { IntentClassifier } from './intent-classifier.js';
import { SchemaLinker } from './schema-linker.js';
import { SqlGenerator } from './sql-generator.js';
import type { PipelineInput, PipelineResult, ConversationTurn } from './types.js';

/**
 * NL2SQL Pipeline — dual-channel architecture:
 * 1. Metric Resolution: if user query matches a known metric, compose SQL from metric definition
 * 2. Full NL2SQL: if no metric match, run full pipeline (intent → schema → generate)
 */
export class NL2SqlPipeline {
  private intentClassifier: IntentClassifier;
  private schemaLinker: SchemaLinker;
  private sqlGenerator: SqlGenerator;

  constructor(
    private db: DbClient,
    private config: { anthropicApiKey?: string } = {},
  ) {
    this.intentClassifier = new IntentClassifier(config.anthropicApiKey);
    this.schemaLinker = new SchemaLinker(db);
    this.sqlGenerator = new SqlGenerator(config.anthropicApiKey);
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const conversationHistory = input.conversationHistory ?? [];
    const dialect = input.dialect ?? 'postgresql';

    // Step 1: Intent classification
    const intent = await this.intentClassifier.classify(
      input.userQuery,
      conversationHistory,
    );

    if (intent.type === 'off_topic') {
      return {
        resolvedVia: 'clarification',
        explanation: 'This question does not appear to be related to data querying.',
        confidence: intent.confidence,
      };
    }

    if (intent.type === 'clarification') {
      return {
        resolvedVia: 'clarification',
        explanation: 'Let me help you formulate your query.',
        confidence: intent.confidence,
        clarificationQuestion:
          'Could you be more specific about what data you want to query?',
      };
    }

    // Step 2: Try metric resolution first
    const metricResult = await this.tryMetricResolution(input);
    if (metricResult) {
      return metricResult;
    }

    // Step 3: Full NL2SQL pipeline
    return this.runFullPipeline(input, conversationHistory, dialect, intent);
  }

  private async tryMetricResolution(
    input: PipelineInput,
  ): Promise<PipelineResult | null> {
    const projectMetrics = await this.db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, input.projectId));

    if (projectMetrics.length === 0) return null;

    // Simple keyword matching for metric names/displayNames
    const queryLower = input.userQuery.toLowerCase();
    const matchedMetric = projectMetrics.find(
      (m) =>
        queryLower.includes(m.name.toLowerCase()) ||
        queryLower.includes(m.displayName.toLowerCase()),
    );

    if (!matchedMetric) return null;

    // Resolve source table name
    let sourceTableName = '{{source_table}}';
    if (matchedMetric.sourceTableId) {
      const [table] = await this.db
        .select()
        .from(schemaTables)
        .where(eq(schemaTables.id, matchedMetric.sourceTableId));
      if (table) sourceTableName = table.name;
    }

    // Compose SQL from metric definition
    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const whereParts: string[] = [];

    // Extract dimensions from user query (simple keyword match for now)
    if (matchedMetric.dimensions) {
      for (const dim of matchedMetric.dimensions) {
        if (queryLower.includes(dim.toLowerCase())) {
          selectParts.push(dim);
          groupByParts.push(dim);
        }
      }
    }

    selectParts.push(`${matchedMetric.expression} AS ${matchedMetric.name}`);

    if (matchedMetric.filters && Array.isArray(matchedMetric.filters)) {
      for (const f of matchedMetric.filters as Array<{
        column: string;
        op: string;
        value: unknown;
      }>) {
        const val = typeof f.value === 'string' ? `'${f.value}'` : String(f.value);
        whereParts.push(`${f.column} ${f.op} ${val}`);
      }
    }

    let sql = `SELECT ${selectParts.join(', ')} FROM ${sourceTableName}`;
    if (whereParts.length > 0) sql += ` WHERE ${whereParts.join(' AND ')}`;
    if (groupByParts.length > 0) sql += ` GROUP BY ${groupByParts.join(', ')}`;

    return {
      resolvedVia: 'metric',
      sql,
      explanation: `Based on metric "${matchedMetric.displayName}": ${matchedMetric.expression}`,
      confidence: 0.9,
      tablesUsed: sourceTableName !== '{{source_table}}' ? [sourceTableName] : [],
    };
  }

  private async runFullPipeline(
    input: PipelineInput,
    conversationHistory: ConversationTurn[],
    dialect: string,
    intent: { type: string; modificationHint?: string },
  ): Promise<PipelineResult> {
    // Load schema context
    const schema = await this.schemaLinker.loadSchema(input.datasourceId);

    // Load glossary
    const glossaryRows = await this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, input.projectId));

    const glossary = glossaryRows.map((g) => ({
      term: g.term,
      sqlExpression: g.sqlExpression,
    }));

    const context = {
      userQuery: input.userQuery,
      schema,
      glossary,
      conversationHistory,
      fewShotExamples: [], // TODO: retrieve from query_history in Phase 5
      dialect,
    };

    // Generate SQL
    let result;
    if (
      intent.type === 'follow_up' &&
      conversationHistory.length > 0
    ) {
      const lastSql = [...conversationHistory]
        .reverse()
        .find((t) => t.sql)?.sql;

      if (lastSql) {
        result = await this.sqlGenerator.generateFollowUp(
          context,
          lastSql,
          intent.modificationHint ?? input.userQuery,
        );
      } else {
        result = await this.sqlGenerator.generate(context);
      }
    } else {
      result = await this.sqlGenerator.generate(context);
    }

    return {
      resolvedVia: 'nl2sql',
      sql: result.sql,
      explanation: result.explanation,
      confidence: result.confidence,
      tablesUsed: result.tablesUsed,
    };
  }
}
