import { eq, sql } from 'drizzle-orm';
import { metrics, glossaryEntries, type DbClient } from '@nl2sql/db';
import { SchemaLinker } from '../schema-linker.js';
import { SqlValidator } from '../sql-validator.js';
import { SqlGenerator } from '../sql-generator.js';
import { SqlVerifier } from '../sql-verifier.js';
import { EmbeddingService } from '../embedding-service.js';
import { RAG } from '../config.js';
import type { SkillResult } from './types.js';
import type { GenerationContext, TokenCallback } from '../types.js';

/**
 * Skill Executor — executes individual skills called by the agent orchestrator.
 * Each method corresponds to a skill defined in skill-definitions.ts.
 */
export class SkillExecutor {
  private schemaLinker: SchemaLinker;
  private sqlGenerator: SqlGenerator;
  private sqlVerifier: SqlVerifier;
  private sqlValidator: SqlValidator;

  constructor(
    private db: DbClient,
    private config: {
      anthropicApiKey?: string;
      anthropicBaseUrl?: string;
      openaiApiKey?: string;
      openaiBaseUrl?: string;
    },
  ) {
    this.schemaLinker = new SchemaLinker(db, config.openaiApiKey, config.openaiBaseUrl);
    this.sqlGenerator = new SqlGenerator(config.anthropicApiKey, config.anthropicBaseUrl);
    this.sqlVerifier = new SqlVerifier(config.anthropicApiKey, config.anthropicBaseUrl);
    this.sqlValidator = new SqlValidator('postgresql');
  }

  async execute(
    skillName: string,
    input: Record<string, unknown>,
    context: { projectId: string; datasourceId: string; dialect: string },
    onToken?: TokenCallback,
  ): Promise<SkillResult> {
    switch (skillName) {
      case 'schema_search':
        return this.schemaSearch(context.datasourceId, input.query as string);
      case 'metric_lookup':
        return this.metricLookup(context.projectId, input.metricName as string);
      case 'knowledge_search':
        return this.knowledgeSearch(context.projectId, input.query as string);
      case 'sql_generate':
        return this.sqlGenerate(
          input.userQuery as string,
          input.schemaContext as string,
          input.additionalContext as string | undefined,
          context.dialect,
          context.datasourceId,
          onToken,
        );
      case 'sql_review':
        return this.sqlReview(
          input.userQuery as string,
          input.sql as string,
          input.schemaContext as string | undefined,
          context.datasourceId,
        );
      case 'sql_validate':
        return this.sqlValidate(input.sql as string, context.datasourceId);
      case 'chart_recommend':
        return this.chartRecommend(input.userQuery as string, input.columns as string | undefined);
      default:
        return { success: false, data: null, error: `Unknown skill: ${skillName}` };
    }
  }

  private async schemaSearch(datasourceId: string, query: string): Promise<SkillResult> {
    const schema = await this.schemaLinker.linkSchema(datasourceId, query);
    const ddl = this.schemaLinker.formatAsDdl(schema);
    return {
      success: true,
      data: {
        ddl,
        tableCount: schema.tables.length,
        relationshipCount: schema.relationships.length,
      },
    };
  }

  private async metricLookup(projectId: string, metricName: string): Promise<SkillResult> {
    const allMetrics = await this.db.select().from(metrics).where(eq(metrics.projectId, projectId));

    const nameLower = metricName.toLowerCase();
    const matched = allMetrics.filter(
      (m) =>
        m.name.toLowerCase().includes(nameLower) || m.displayName.toLowerCase().includes(nameLower),
    );

    if (matched.length === 0) {
      return {
        success: true,
        data: { found: false, message: `没有找到名为"${metricName}"的指标` },
      };
    }

    return {
      success: true,
      data: {
        found: true,
        metrics: matched.map((m) => ({
          name: m.name,
          displayName: m.displayName,
          expression: m.expression,
          filters: m.filters,
          dimensions: m.dimensions,
        })),
      },
    };
  }

  private async knowledgeSearch(projectId: string, query: string): Promise<SkillResult> {
    // Glossary exact match
    const glossary = await this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, projectId));

    const queryLower = query.toLowerCase();
    const matchedTerms = glossary.filter(
      (g) => queryLower.includes(g.term.toLowerCase()) || g.term.toLowerCase().includes(queryLower),
    );

    // RAG chunk search via pgvector
    let ragChunks: string[] = [];
    if (this.config.openaiApiKey) {
      try {
        const embService = new EmbeddingService(
          this.config.openaiApiKey,
          this.config.openaiBaseUrl,
        );
        const queryEmbedding = await embService.embedSingle(query);
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        const results = await this.db.execute<{
          content: string;
          title: string;
          distance: number;
        }>(sql`
          SELECT kc.content, kd.title,
                 kc.embedding <=> ${vectorStr}::vector AS distance
          FROM knowledge_chunks kc
          INNER JOIN knowledge_docs kd ON kd.id = kc.doc_id
          WHERE kd.project_id = ${projectId}
            AND kc.embedding IS NOT NULL
          ORDER BY distance ASC
          LIMIT 3
        `);

        if (results.rows) {
          ragChunks = results.rows
            .filter((r) => r.distance < RAG.distanceThreshold)
            .map((r) => `[${r.title}] ${r.content}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          JSON.stringify({ level: 'warn', msg: 'Knowledge search embedding failed', error: msg }) +
            '\n',
        );
      }
    }

    return {
      success: true,
      data: {
        glossary: matchedTerms.map((g) => ({
          term: g.term,
          sql: g.sqlExpression,
          description: g.description,
        })),
        documents: ragChunks,
      },
    };
  }

  /**
   * SQL generation — uses rawDdl from schema_search (already embedding-filtered)
   * when available, falls back to full DB schema load.
   */
  private async sqlGenerate(
    userQuery: string,
    schemaContext: string | undefined,
    additionalContext: string | undefined,
    dialect: string,
    datasourceId: string,
    onToken?: TokenCallback,
  ): Promise<SkillResult> {
    const query = additionalContext ? `${userQuery}\n\n补充信息:\n${additionalContext}` : userQuery;

    // Prefer rawDdl from schema_search (already filtered by embedding relevance)
    // Fall back to full DB schema load when agent didn't pass DDL
    if (schemaContext?.trim()) {
      const context: GenerationContext = {
        userQuery: query,
        schema: { tables: [], relationships: [] },
        rawDdl: schemaContext,
        glossary: [],
        knowledgeContext: [],
        conversationHistory: [],
        fewShotExamples: [],
        dialect,
      };
      const result = await this.sqlGenerator.generate(context, onToken);
      return { success: true, data: result };
    }

    const schema = await this.schemaLinker.loadSchema(datasourceId);
    const context: GenerationContext = {
      userQuery: query,
      schema,
      glossary: [],
      knowledgeContext: [],
      conversationHistory: [],
      fewShotExamples: [],
      dialect,
    };
    const result = await this.sqlGenerator.generate(context, onToken);
    return { success: true, data: result };
  }

  /**
   * SQL review — uses rawDdl from agent when available for context,
   * always loads structured schema for cross-validation.
   */
  private async sqlReview(
    userQuery: string,
    sqlStr: string,
    schemaContext: string | undefined,
    datasourceId: string,
  ): Promise<SkillResult> {
    const schema = await this.schemaLinker.loadSchema(datasourceId);
    const verification = await this.sqlVerifier.verify(userQuery, sqlStr, schema, schemaContext);
    return { success: true, data: verification };
  }

  /**
   * SQL validation — loads schema for cross-validation when available.
   */
  private async sqlValidate(sqlStr: string, datasourceId: string): Promise<SkillResult> {
    let schema;
    try {
      schema = await this.schemaLinker.loadSchema(datasourceId);
    } catch {
      // Schema load failed — validate without schema cross-check
    }
    const validation = this.sqlValidator.validate(sqlStr, schema);
    return { success: true, data: validation };
  }

  private async chartRecommend(
    userQuery: string,
    columns: string | undefined,
  ): Promise<SkillResult> {
    const { ChartSelector } = await import('../chart-selector.js');
    const selector = new ChartSelector(this.config.anthropicApiKey, this.config.anthropicBaseUrl);

    const parsedColumns = columns
      ? columns.split(',').map((c) => {
          const [name, type] = c.trim().split('(');
          return { name: name.trim(), dataType: (type ?? 'unknown').replace(')', '').trim() };
        })
      : [];

    const result = await selector.select(userQuery, '', parsedColumns, []);
    return { success: true, data: result };
  }
}
