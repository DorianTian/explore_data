import { eq, desc, sql } from 'drizzle-orm';
import {
  metrics,
  glossaryEntries,
  knowledgeChunks,
  knowledgeDocs,
  schemaTables,
  queryHistory,
  type DbClient,
} from '@nl2sql/db';
import { IntentClassifier } from './intent-classifier.js';
import { SchemaLinker } from './schema-linker.js';
import { SqlGenerator } from './sql-generator.js';
import { QueryDecomposer } from './query-decomposer.js';
import { SchemaReranker } from './schema-reranker.js';
import { SqlVerifier } from './sql-verifier.js';
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
  private queryDecomposer: QueryDecomposer;
  private schemaLinker: SchemaLinker;
  private schemaReranker: SchemaReranker;
  private sqlGenerator: SqlGenerator;
  private sqlVerifier: SqlVerifier;

  constructor(
    private db: DbClient,
    private config: {
      anthropicApiKey?: string;
      anthropicBaseUrl?: string;
      openaiApiKey?: string;
      openaiBaseUrl?: string;
    } = {},
  ) {
    const anthropicBase = config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL;
    const openaiBase = config.openaiBaseUrl ?? process.env.OPENAI_BASE_URL;

    this.intentClassifier = new IntentClassifier(config.anthropicApiKey, anthropicBase);
    this.queryDecomposer = new QueryDecomposer(config.anthropicApiKey, anthropicBase);
    this.schemaLinker = new SchemaLinker(db, config.openaiApiKey, openaiBase);
    this.schemaReranker = new SchemaReranker(config.anthropicApiKey, anthropicBase);
    this.sqlGenerator = new SqlGenerator(config.anthropicApiKey, anthropicBase);
    this.sqlVerifier = new SqlVerifier(config.anthropicApiKey, anthropicBase);
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const conversationHistory = input.conversationHistory ?? [];
    const dialect = input.dialect ?? 'postgresql';

    // Step 1: Router — classify intent + complexity
    const { QueryRouter } = await import('./skills/index.js');
    const router = new QueryRouter(
      this.config.anthropicApiKey,
      this.config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL,
    );
    const classification = await router.classify(input.userQuery, conversationHistory);

    if (classification.type === 'off_topic' || classification.type === 'clarification') {
      const skillsMod = await import('./skills/index.js');
      const orch = new skillsMod.AgentOrchestrator(this.db, this.config);
      return orch.run(input.userQuery, classification, {
        projectId: input.projectId,
        datasourceId: input.datasourceId,
        dialect,
        conversationHistory,
      });
    }

    // Step 2: Try metric resolution first (high accuracy path)
    const metricResult = await this.tryMetricResolution(input);
    if (metricResult) return metricResult;

    // Step 3: Agent orchestrator — routes to simple or agent path based on complexity
    const skills = await import('./skills/index.js');
    const orchestrator = new skills.AgentOrchestrator(this.db, this.config);
    return orchestrator.run(input.userQuery, classification, {
      projectId: input.projectId,
      datasourceId: input.datasourceId,
      dialect,
      conversationHistory,
    });
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

    // Find all matching metrics
    const matchedMetrics = projectMetrics.filter(
      (m) =>
        queryLower.includes(m.name.toLowerCase()) ||
        queryLower.includes(m.displayName.toLowerCase()),
    );

    // If multiple metrics match or none match, skip metric resolution
    // Multi-metric queries need full NL2SQL for proper JOIN and grouping
    if (matchedMetrics.length !== 1) return null;

    // If query has complex intent indicators, prefer full NL2SQL
    const complexIndicators = ['对比', '趋势', '同比', '环比', '占比', '分布', '关联', '和', '以及'];
    const hasComplexIntent = complexIndicators.some((w) => queryLower.includes(w));

    // If query mentions tables/entities not related to the metric, prefer full NL2SQL
    const crossTableIndicators = ['用户', '商品', '产品', '分类', '品类', '品牌'];
    const hasCrossTable = crossTableIndicators.some((w) => queryLower.includes(w));

    if (hasComplexIntent || hasCrossTable) return null;

    const matchedMetric = matchedMetrics[0];

    if (!matchedMetric.sourceTableId) return null;

    const [sourceTable] = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.id, matchedMetric.sourceTableId));

    if (!sourceTable) return null;

    const sourceTableName = sourceTable.name;

    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const whereParts: string[] = [];

    if (matchedMetric.dimensions) {
      for (const dim of matchedMetric.dimensions) {
        if (this.dimensionMatchesQuery(dim, queryLower)) {
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
        const val =
          typeof f.value === 'string'
            ? `'${String(f.value).replace(/'/g, "''")}'`
            : String(f.value);
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
      tablesUsed: [sourceTableName],
    };
  }

  /** Match dimension name against query with Chinese alias support */
  private dimensionMatchesQuery(dimension: string, query: string): boolean {
    const dimLower = dimension.toLowerCase();

    // Direct match
    if (query.includes(dimLower)) return true;

    // Chinese alias mapping for common dimension names
    const aliases: Record<string, string[]> = {
      channel: ['渠道', '来源', '入口'],
      region: ['地区', '区域', '省份', '城市', '地域'],
      category: ['分类', '类目', '品类'],
      brand: ['品牌'],
      status: ['状态'],
      order_date: ['日期', '时间', '按天', '按日', '每天', '每日'],
      month: ['月', '按月', '每月', '月份'],
      week: ['周', '按周', '每周'],
      year: ['年', '按年', '每年', '年份'],
      device: ['设备', '终端', '客户端'],
      gender: ['性别'],
      city: ['城市'],
      product: ['商品', '产品'],
      user: ['用户'],
    };

    const dimAliases = aliases[dimLower] ?? [];
    return dimAliases.some((alias) => query.includes(alias));
  }

  private async runFullPipeline(
    input: PipelineInput,
    conversationHistory: ConversationTurn[],
    dialect: string,
    intent: { type: string; modificationHint?: string },
  ): Promise<PipelineResult> {
    // Node 1: Query Decomposition — detect if query needs multi-step reasoning
    const decomposition = await this.queryDecomposer.decompose(input.userQuery);

    // Node 2: Schema Linking (embedding recall)
    let schema = await this.schemaLinker.linkSchema(
      input.datasourceId,
      input.userQuery,
    );

    // Node 3: Schema Rerank (LLM precision filter for large schemas)
    schema = await this.schemaReranker.rerank(input.userQuery, schema);

    // Node 4: Load glossary
    const glossaryRows = await this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, input.projectId));

    const glossary = glossaryRows.map((g) => ({
      term: g.term,
      sqlExpression: g.sqlExpression,
    }));

    // Node 5: RAG — retrieve relevant knowledge documents
    const knowledgeContext = await this.retrieveKnowledgeContext(
      input.projectId,
      input.userQuery,
    );

    // Node 6: Data flywheel — retrieve similar accepted queries as few-shot examples
    const fewShotExamples = await this.retrieveFewShotExamples(
      input.projectId,
      input.userQuery,
    );

    // Build generation context
    let queryForGeneration = input.userQuery;

    // If query was decomposed, include the decomposition plan as context
    if (decomposition.isComplex && decomposition.subQueries.length > 1) {
      const steps = decomposition.subQueries
        .map((sq) => `Step ${sq.step}: ${sq.description}`)
        .join('\n');
      queryForGeneration = `${input.userQuery}\n\n[查询拆解]\n${steps}\n合并策略: ${decomposition.mergeStrategy}\n请按此拆解逻辑生成完整 SQL。`;
    }

    const context = {
      userQuery: queryForGeneration,
      schema,
      glossary,
      knowledgeContext,
      conversationHistory,
      fewShotExamples,
      dialect,
    };

    // Node 7: SQL Generation
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

    // Node 8: SQL Self-Verification — LLM checks its own output for logical correctness
    if (result.sql && result.confidence < 0.95) {
      const verification = await this.sqlVerifier.verify(
        input.userQuery,
        result.sql,
        schema,
      );

      if (!verification.isCorrect && verification.suggestedFix) {
        result = {
          ...result,
          sql: verification.suggestedFix,
          explanation: `${result.explanation}\n（已自动修正：${verification.issues.join('；')}）`,
          confidence: Math.min(result.confidence + 0.1, 0.95),
        };
      }
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

  /**
   * RAG: retrieve relevant knowledge chunks via pgvector similarity.
   * Returns top-5 most relevant document chunks for the user query.
   */
  private async retrieveKnowledgeContext(
    projectId: string,
    userQuery: string,
  ): Promise<string[]> {
    if (!process.env.OPENAI_API_KEY) return [];

    try {
      const embService = new EmbeddingService(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_BASE_URL,
      );
      const queryEmbedding = await embService.embedSingle(userQuery);
      const vectorStr = `[${queryEmbedding.join(',')}]`;

      const results = await this.db.execute<{
        content: string;
        distance: number;
        title: string;
      }>(sql`
        SELECT kc.content, kd.title,
               kc.embedding <=> ${vectorStr}::vector AS distance
        FROM knowledge_chunks kc
        INNER JOIN knowledge_docs kd ON kd.id = kc.doc_id
        WHERE kd.project_id = ${projectId}
          AND kc.embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT 5
      `);

      if (!results.rows || results.rows.length === 0) return [];

      // Only include chunks with reasonable similarity (distance < 0.7)
      return results.rows
        .filter((r) => r.distance < 0.7)
        .map((r) => `[${r.title}] ${r.content}`);
    } catch {
      return [];
    }
  }
}
