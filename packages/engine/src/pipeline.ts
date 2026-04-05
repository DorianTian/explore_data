import { eq, desc, sql } from 'drizzle-orm';
import {
  metrics,
  glossaryEntries,
  schemaTables,
  datasources,
  queryHistory,
  type DbClient,
} from '@nl2sql/db';
import { SchemaLinker } from './schema-linker.js';
import { SqlGenerator } from './sql-generator.js';
import { QueryDecomposer } from './query-decomposer.js';
import { SchemaReranker } from './schema-reranker.js';
import { EmbeddingService } from './embedding-service.js';
import { QueryRouter } from './skills/router.js';
import { AgentOrchestrator } from './skills/agent-orchestrator.js';
import { runVerificationLoop } from './verification-loop.js';
import { PIPELINE, RAG } from './config.js';
import type { PipelineInput, PipelineResult, ConversationTurn, ProgressCallback } from './types.js';

/** Engine-wide config passed to pipeline constructor */
export interface EngineConfig {
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
}

/**
 * NL2SQL Pipeline — dual-channel architecture:
 * 1. Metric Resolution: if user query matches a known metric, compose SQL directly
 * 2. Full NL2SQL: router → (simple: full pipeline / complex: agent orchestrator)
 *
 * Full pipeline stages: decompose → schema link → rerank → glossary + RAG + few-shot → generate → verify
 * Agent path: LLM tool-use loop with skills for complex multi-step reasoning
 *
 * Data flywheel: user corrections get recorded and retrieved as few-shot examples
 */
export class NL2SqlPipeline {
  private router: QueryRouter;
  private orchestrator: AgentOrchestrator;
  private queryDecomposer: QueryDecomposer;
  private schemaLinker: SchemaLinker;
  private schemaReranker: SchemaReranker;
  private sqlGenerator: SqlGenerator;
  private embeddingService: EmbeddingService | null;

  constructor(
    private db: DbClient,
    private config: EngineConfig = {},
  ) {
    const anthropicBase = config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL;
    const openaiBase = config.openaiBaseUrl ?? process.env.OPENAI_BASE_URL;
    const openaiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY;

    this.router = new QueryRouter(config.anthropicApiKey, anthropicBase);
    this.orchestrator = new AgentOrchestrator(db, config);
    this.queryDecomposer = new QueryDecomposer(config.anthropicApiKey, anthropicBase);
    this.schemaLinker = new SchemaLinker(db, openaiKey, openaiBase);
    this.schemaReranker = new SchemaReranker(config.anthropicApiKey, anthropicBase);
    this.sqlGenerator = new SqlGenerator(config.anthropicApiKey, anthropicBase);
    this.embeddingService = openaiKey ? new EmbeddingService(openaiKey, openaiBase) : null;
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const conversationHistory = input.conversationHistory ?? [];
    const dialect = input.dialect ?? 'postgresql';
    const progress = input.onProgress ?? (() => {});
    const onToken = input.onToken;

    // Step 1: Router — classify intent + complexity
    progress('intent_classification', '正在分析查询意图...');
    const classification = await this.router.classify(input.userQuery, conversationHistory);

    // Off-topic / clarification → agent handles conversationally
    if (classification.type === 'off_topic' || classification.type === 'clarification') {
      return this.orchestrator.run(input.userQuery, classification, {
        projectId: input.projectId,
        datasourceId: input.datasourceId,
        dialect,
        conversationHistory,
        onProgress: progress,
        onToken,
      });
    }

    // Step 2: Try metric resolution first (high accuracy path)
    progress('metric_resolution', '正在匹配业务指标...');
    const metricResult = await this.tryMetricResolution(input);
    if (metricResult) return metricResult;

    // Step 3: Route by complexity
    if (classification.complexity === 'complex') {
      // Complex queries → agent orchestrator with tool-use loop
      return this.orchestrator.run(input.userQuery, classification, {
        projectId: input.projectId,
        datasourceId: input.datasourceId,
        dialect,
        conversationHistory,
        onProgress: progress,
        onToken,
      });
    }

    // Simple/moderate queries → full deterministic pipeline
    return this.runFullPipeline(
      input,
      conversationHistory,
      dialect,
      {
        type: classification.type,
        modificationHint: classification.modificationHint,
      },
      progress,
      onToken,
    );
  }

  private async tryMetricResolution(input: PipelineInput): Promise<PipelineResult | null> {
    const progress: ProgressCallback = input.onProgress ?? (() => {});
    const projectMetrics = await this.db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, input.projectId));

    if (projectMetrics.length === 0) return null;

    const queryLower = input.userQuery.toLowerCase();

    // Find matching metrics using word-boundary matching (not substring)
    const matchedMetrics = projectMetrics.filter((m) => {
      const namePattern = new RegExp(`\\b${escapeRegex(m.name.toLowerCase())}\\b`);
      const displayPattern = new RegExp(`\\b${escapeRegex(m.displayName.toLowerCase())}\\b`);
      return (
        namePattern.test(queryLower) ||
        displayPattern.test(queryLower) ||
        queryLower.includes(m.displayName.toLowerCase())
      );
    });

    // If multiple metrics match or none match, skip metric resolution
    // Multi-metric queries need full NL2SQL for proper JOIN and grouping
    if (matchedMetrics.length !== 1) return null;

    // If query has complex intent indicators, prefer full NL2SQL
    const complexIndicators = [
      '对比',
      '趋势',
      '同比',
      '环比',
      '占比',
      '分布',
      '关联',
      '和',
      '以及',
      'compare',
      'trend',
      'versus',
      'vs',
      'distribution',
      'correlation',
    ];
    const hasComplexIntent = complexIndicators.some((w) => queryLower.includes(w));

    // If query mentions tables/entities not related to the metric, prefer full NL2SQL
    const crossTableIndicators = [
      '用户',
      '商品',
      '产品',
      '分类',
      '品类',
      '品牌',
      'user',
      'product',
      'category',
      'brand',
    ];
    const hasCrossTable = crossTableIndicators.some((w) => queryLower.includes(w));

    if (hasComplexIntent || hasCrossTable) return null;

    const matchedMetric = matchedMetrics[0];

    if (!matchedMetric.sourceTableId) return null;

    const [sourceTable] = await this.db
      .select()
      .from(schemaTables)
      .where(eq(schemaTables.id, matchedMetric.sourceTableId));

    if (!sourceTable) return null;

    // Resolve schema prefix from datasource connectionConfig for fully-qualified table name
    let schemaPrefix = '';
    try {
      const [ds] = await this.db
        .select()
        .from(datasources)
        .where(eq(datasources.id, input.datasourceId));
      const connConfig = ds?.connectionConfig as { schema?: string } | null;
      if (connConfig?.schema) {
        schemaPrefix = connConfig.schema;
      }
    } catch {
      // Schema prefix lookup failed, continue with unqualified name
    }

    const qualifiedTableName = schemaPrefix
      ? `${quoteIdentifier(schemaPrefix)}.${quoteIdentifier(sourceTable.name)}`
      : quoteIdentifier(sourceTable.name);

    const selectParts: string[] = [];
    const groupByParts: string[] = [];
    const whereParts: string[] = [];

    if (matchedMetric.dimensions) {
      for (const dim of matchedMetric.dimensions) {
        if (this.dimensionMatchesQuery(dim, queryLower)) {
          selectParts.push(quoteIdentifier(dim));
          groupByParts.push(quoteIdentifier(dim));
        }
      }
    }

    selectParts.push(`${matchedMetric.expression} AS ${quoteIdentifier(matchedMetric.name)}`);

    if (matchedMetric.filters && Array.isArray(matchedMetric.filters)) {
      for (const f of matchedMetric.filters as Array<{
        column: string;
        op: string;
        value: unknown;
      }>) {
        const quotedCol = quoteIdentifier(f.column);
        const val =
          typeof f.value === 'string'
            ? `'${String(f.value).replace(/'/g, "''")}'`
            : String(f.value);
        whereParts.push(`${quotedCol} ${f.op} ${val}`);
      }
    }

    let metricSql = `SELECT ${selectParts.join(', ')} FROM ${qualifiedTableName}`;
    if (whereParts.length > 0) metricSql += ` WHERE ${whereParts.join(' AND ')}`;
    if (groupByParts.length > 0) metricSql += ` GROUP BY ${groupByParts.join(', ')}`;

    progress('metric_resolution', `Matched metric: ${matchedMetric.displayName}`, {
      thinking: `Metric: ${matchedMetric.displayName} (${matchedMetric.name})\nExpression: ${matchedMetric.expression}\nSource table: ${schemaPrefix ? `${schemaPrefix}.` : ''}${sourceTable.name}\nDimensions matched: ${groupByParts.length > 0 ? groupByParts.join(', ') : 'none'}\nFilters: ${whereParts.length > 0 ? whereParts.join(' AND ') : 'none'}`,
      data: {
        metricName: matchedMetric.name,
        table: sourceTable.name,
        schemaPrefix: schemaPrefix || null,
      },
    });

    return {
      resolvedVia: 'metric',
      sql: metricSql,
      explanation: `基于指标「${matchedMetric.displayName}」生成查询：${matchedMetric.expression}`,
      confidence: 0.9,
      tablesUsed: [sourceTable.name],
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

  /**
   * Full deterministic pipeline for simple/moderate queries.
   * Decompose → Schema Link → Rerank → Glossary + RAG + FewShot → Generate → Verify
   */
  private async runFullPipeline(
    input: PipelineInput,
    conversationHistory: ConversationTurn[],
    dialect: string,
    intent: { type: string; modificationHint?: string },
    progress: ProgressCallback,
    onToken?: (token: string) => void,
  ): Promise<PipelineResult> {
    // Node 1: Query Decomposition — detect if query needs multi-step reasoning
    progress('query_decomposition', '正在拆解查询逻辑...');
    const decomposition = await this.queryDecomposer.decompose(input.userQuery);

    // Node 2: Schema Linking (embedding recall)
    progress('schema_linking', '正在匹配数据模型...');
    let schema = await this.schemaLinker.linkSchema(input.datasourceId, input.userQuery, progress);

    // Node 3: Schema Rerank (LLM precision filter for large schemas)
    progress('schema_rerank', '正在精选相关表结构...');
    schema = await this.schemaReranker.rerank(input.userQuery, schema, progress);

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
    progress('knowledge_retrieval', '正在检索相关知识文档...');
    const knowledgeContext = await this.retrieveKnowledgeContext(input.projectId, input.userQuery);

    // Node 6: Data flywheel — retrieve similar accepted queries as few-shot examples
    progress('few_shot_retrieval', '正在检索相似案例...');
    const fewShotExamples = await this.retrieveFewShotExamples(input.projectId, input.userQuery);

    // Build generation context
    let queryForGeneration = input.userQuery;

    // If query was decomposed, include the decomposition plan as context
    if (decomposition.isComplex && decomposition.subQueries.length > 1) {
      const steps = decomposition.subQueries
        .map((sq) => `Step ${sq.step}: ${sq.description}`)
        .join('\n');
      queryForGeneration = `${input.userQuery}\n\n[查询拆解]\n${steps}\n合并策略: ${decomposition.mergeStrategy}\n请按此拆解逻辑生成完整 SQL。`;
    }

    // Resolve schema prefix from datasource connection config
    let schemaPrefix: string | undefined;
    try {
      const [ds] = await this.db
        .select()
        .from(datasources)
        .where(eq(datasources.id, input.datasourceId));
      const connConfig = ds?.connectionConfig as { schema?: string } | null;
      if (connConfig?.schema) {
        schemaPrefix = connConfig.schema;
      }
    } catch {
      // Best-effort schema prefix resolution
    }

    const context = {
      userQuery: queryForGeneration,
      schema,
      glossary,
      knowledgeContext,
      conversationHistory,
      fewShotExamples,
      dialect,
      schemaPrefix,
    };

    // Node 7: SQL Generation (with optional token streaming)
    progress('sql_generation', '正在生成 SQL...');
    let result;
    if (intent.type === 'follow_up' && conversationHistory.length > 0) {
      const lastSql = [...conversationHistory].reverse().find((t) => t.sql)?.sql;

      if (lastSql) {
        result = await this.sqlGenerator.generateFollowUp(
          context,
          lastSql,
          intent.modificationHint ?? input.userQuery,
          onToken,
        );
      } else {
        result = await this.sqlGenerator.generate(context, onToken);
      }
    } else {
      result = await this.sqlGenerator.generate(context, onToken);
    }

    // Node 8: Verification Loop — dual-stage (static + LLM semantic) with scoring
    progress('sql_verification', '正在审查 SQL 正确性...');
    if (result.sql && result.confidence < PIPELINE.verificationThreshold) {
      const anthropicBase = this.config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL;
      const loopResult = await runVerificationLoop(
        result.sql,
        input.userQuery,
        schema,
        dialect,
        progress,
        this.config.anthropicApiKey,
        anthropicBase,
      );

      if (loopResult.finalSql !== result.sql) {
        const issuesSummary = loopResult.rounds
          .flatMap((r) => [...r.staticIssues, ...r.semanticIssues])
          .filter(Boolean);
        result = {
          ...result,
          sql: loopResult.finalSql,
          explanation:
            issuesSummary.length > 0
              ? `${result.explanation}\n（已自动修正：${issuesSummary.slice(0, 3).join('；')}）`
              : result.explanation,
        };
      }

      // Adjust confidence based on verification score
      const scoreRatio = loopResult.finalScore / 100;
      result = {
        ...result,
        confidence: Math.min(result.confidence * 0.5 + scoreRatio * 0.5, 0.99),
      };
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
   * Uses embedding similarity when available, falls back to recent history.
   */
  private async retrieveFewShotExamples(
    projectId: string,
    userQuery: string,
  ): Promise<Array<{ question: string; sql: string }>> {
    // Try embedding-based retrieval first
    if (this.embeddingService) {
      try {
        const queryEmbedding = await this.embeddingService.embedSingle(userQuery);
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        const results = await this.db.execute<{
          natural_language: string;
          generated_sql: string;
          corrected_sql: string | null;
          distance: number;
        }>(sql`
          SELECT qh.natural_language, qh.generated_sql, qh.corrected_sql,
                 qh.natural_language <-> ${vectorStr}::vector AS distance
          FROM query_history qh
          WHERE qh.project_id = ${projectId}
            AND (qh.corrected_sql IS NOT NULL OR qh.was_accepted > 0.5)
          ORDER BY distance ASC
          LIMIT ${PIPELINE.maxFewShotExamples}
        `);

        if (results.rows && results.rows.length > 0) {
          return results.rows
            .filter((r) => r.distance < RAG.distanceThreshold)
            .map((r) => ({
              question: r.natural_language,
              sql: r.corrected_sql ?? r.generated_sql,
            }));
        }
      } catch {
        // Embedding search not available (no vector column on query_history),
        // fall through to recency-based retrieval
      }
    }

    // Fallback: recency-based retrieval
    const history = await this.db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.projectId, projectId))
      .orderBy(desc(queryHistory.createdAt))
      .limit(PIPELINE.maxFewShotExamples);

    return history
      .filter((h) => h.correctedSql || (h.wasAccepted && h.wasAccepted > 0.5))
      .map((h) => ({
        question: h.naturalLanguage,
        sql: h.correctedSql ?? h.generatedSql,
      }));
  }

  /**
   * RAG: retrieve relevant knowledge chunks via pgvector similarity.
   * Returns top-K most relevant document chunks for the user query.
   */
  private async retrieveKnowledgeContext(projectId: string, userQuery: string): Promise<string[]> {
    if (!this.embeddingService) return [];

    try {
      const queryEmbedding = await this.embeddingService.embedSingle(userQuery);
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
        LIMIT ${RAG.topK}
      `);

      if (!results.rows || results.rows.length === 0) return [];

      return results.rows
        .filter((r) => r.distance < RAG.distanceThreshold)
        .map((r) => `[${r.title}] ${r.content}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        JSON.stringify({ level: 'warn', msg: 'Knowledge retrieval failed', error: msg }) + '\n',
      );
      return [];
    }
  }
}

/** Quote a SQL identifier to prevent injection and handle reserved words */
function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
