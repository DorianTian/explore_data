import { eq, desc, sql as drizzleSql } from 'drizzle-orm';
import {
  metrics,
  glossaryEntries,
  schemaTables,
  queryHistory,
  type DbClient,
} from '@nl2sql/db';
import { IntentClassifier } from './intent-classifier.js';
import { SchemaLinker } from './schema-linker.js';
import { SqlGenerator } from './sql-generator.js';
import { EmbeddingService } from './embedding-service.js';
import type { PipelineInput, PipelineResult, ConversationTurn } from './types.js';

/**
 * NL2SQL Pipeline — dual-channel architecture:
 * 1. Metric Resolution: if user query matches a known metric, compose SQL directly
 * 2. Full NL2SQL: intent → schema linking → glossary + few-shot → SQL generation
 *
 * Data flywheel: user corrections get recorded and retrieved as few-shot examples
 */
export class NL2SqlPipeline {
  private intentClassifier: IntentClassifier;
  private schemaLinker: SchemaLinker;
  private sqlGenerator: SqlGenerator;
  private embeddingService: EmbeddingService | null;

  constructor(
    private db: DbClient,
    config: {
      anthropicApiKey?: string;
      openaiApiKey?: string;
    } = {},
  ) {
    this.intentClassifier = new IntentClassifier(config.anthropicApiKey);
    this.schemaLinker = new SchemaLinker(db, config.openaiApiKey);
    this.sqlGenerator = new SqlGenerator(config.anthropicApiKey);
    this.embeddingService = config.openaiApiKey
      ? new EmbeddingService(config.openaiApiKey)
      : null;
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
        explanation: '这个问题似乎和数据查询无关，请描述您想查询的数据内容。',
        confidence: intent.confidence,
      };
    }

    if (intent.type === 'clarification') {
      return {
        resolvedVia: 'clarification',
        explanation: '我可以帮您查询数据，请更具体地描述您需要什么信息。',
        confidence: intent.confidence,
        clarificationQuestion: '请问您想查询哪些数据？可以描述一下您关注的指标、时间范围或维度。',
      };
    }

    // Step 2: Try metric resolution first (high accuracy path)
    const metricResult = await this.tryMetricResolution(input);
    if (metricResult) return metricResult;

    // Step 3: Full NL2SQL pipeline (flexible path)
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

    const queryLower = input.userQuery.toLowerCase();
    const matchedMetric = projectMetrics.find(
      (m) =>
        queryLower.includes(m.name.toLowerCase()) ||
        queryLower.includes(m.displayName.toLowerCase()),
    );

    if (!matchedMetric) return null;

    let sourceTableName = '{{source_table}}';
    if (matchedMetric.sourceTableId) {
      const [table] = await this.db
        .select()
        .from(schemaTables)
        .where(eq(schemaTables.id, matchedMetric.sourceTableId));
      if (table) sourceTableName = table.name;
    }

    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const whereParts: string[] = [];

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
      explanation: `基于指标「${matchedMetric.displayName}」生成查询：${matchedMetric.expression}`,
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
    // Smart schema linking — uses embeddings for large schemas
    const schema = await this.schemaLinker.linkSchema(
      input.datasourceId,
      input.userQuery,
    );

    // Load glossary
    const glossaryRows = await this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, input.projectId));

    const glossary = glossaryRows.map((g) => ({
      term: g.term,
      sqlExpression: g.sqlExpression,
    }));

    // Data flywheel — retrieve similar accepted queries as few-shot examples
    const fewShotExamples = await this.retrieveFewShotExamples(
      input.projectId,
      input.userQuery,
    );

    const context = {
      userQuery: input.userQuery,
      schema,
      glossary,
      conversationHistory,
      fewShotExamples,
      dialect,
    };

    let result;
    if (intent.type === 'follow_up' && conversationHistory.length > 0) {
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

  /**
   * Data flywheel: retrieve previously accepted queries as few-shot examples.
   * Uses simple text matching for now; will upgrade to embedding similarity later.
   */
  private async retrieveFewShotExamples(
    projectId: string,
    _userQuery: string,
  ): Promise<Array<{ question: string; sql: string }>> {
    const history = await this.db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.projectId, projectId))
      .orderBy(desc(queryHistory.createdAt))
      .limit(5);

    return history
      .filter((h) => h.correctedSql || (h.wasAccepted && h.wasAccepted > 0.5))
      .map((h) => ({
        question: h.naturalLanguage,
        sql: h.correctedSql ?? h.generatedSql,
      }));
  }
}
