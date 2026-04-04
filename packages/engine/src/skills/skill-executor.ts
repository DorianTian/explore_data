import { eq, sql } from 'drizzle-orm';
import {
  metrics,
  glossaryEntries,
  knowledgeChunks,
  knowledgeDocs,
  type DbClient,
} from '@nl2sql/db';
import { SchemaLinker } from '../schema-linker.js';
import { SqlValidator } from '../sql-validator.js';
import { SqlGenerator } from '../sql-generator.js';
import { SqlVerifier } from '../sql-verifier.js';
import { EmbeddingService } from '../embedding-service.js';
import type { SkillResult } from './types.js';
import type { SchemaContext, GenerationContext } from '../types.js';

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
    this.schemaLinker = new SchemaLinker(
      db,
      config.openaiApiKey,
      config.openaiBaseUrl,
    );
    this.sqlGenerator = new SqlGenerator(
      config.anthropicApiKey,
      config.anthropicBaseUrl,
    );
    this.sqlVerifier = new SqlVerifier(
      config.anthropicApiKey,
      config.anthropicBaseUrl,
    );
    this.sqlValidator = new SqlValidator('postgresql');
  }

  async execute(
    skillName: string,
    input: Record<string, unknown>,
    context: { projectId: string; datasourceId: string; dialect: string },
  ): Promise<SkillResult> {
    switch (skillName) {
      case 'schema_search':
        return this.schemaSearch(
          context.datasourceId,
          input.query as string,
        );
      case 'metric_lookup':
        return this.metricLookup(
          context.projectId,
          input.metricName as string,
        );
      case 'knowledge_search':
        return this.knowledgeSearch(
          context.projectId,
          input.query as string,
        );
      case 'sql_generate':
        return this.sqlGenerate(
          input.userQuery as string,
          input.schemaContext as string,
          input.additionalContext as string | undefined,
          context.dialect,
        );
      case 'sql_review':
        return this.sqlReview(
          input.userQuery as string,
          input.sql as string,
          input.schemaContext as string | undefined,
          context.datasourceId,
        );
      case 'sql_validate':
        return this.sqlValidate(input.sql as string);
      case 'chart_recommend':
        return this.chartRecommend(
          input.userQuery as string,
          input.columns as string | undefined,
        );
      default:
        return { success: false, data: null, error: `Unknown skill: ${skillName}` };
    }
  }

  private async schemaSearch(
    datasourceId: string,
    query: string,
  ): Promise<SkillResult> {
    const schema = await this.schemaLinker.linkSchema(datasourceId, query);
    const ddl = this.schemaLinker.formatAsDdl(schema);
    return {
      success: true,
      data: { ddl, tableCount: schema.tables.length, relationshipCount: schema.relationships.length },
    };
  }

  private async metricLookup(
    projectId: string,
    metricName: string,
  ): Promise<SkillResult> {
    const allMetrics = await this.db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, projectId));

    const nameLower = metricName.toLowerCase();
    const matched = allMetrics.filter(
      (m) =>
        m.name.toLowerCase().includes(nameLower) ||
        m.displayName.toLowerCase().includes(nameLower),
    );

    if (matched.length === 0) {
      return { success: true, data: { found: false, message: `没有找到名为"${metricName}"的指标` } };
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

  private async knowledgeSearch(
    projectId: string,
    query: string,
  ): Promise<SkillResult> {
    // Glossary exact match
    const glossary = await this.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.projectId, projectId));

    const queryLower = query.toLowerCase();
    const matchedTerms = glossary.filter((g) =>
      queryLower.includes(g.term.toLowerCase()) || g.term.toLowerCase().includes(queryLower),
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
            .filter((r) => r.distance < 0.7)
            .map((r) => `[${r.title}] ${r.content}`);
        }
      } catch {
        // best-effort
      }
    }

    return {
      success: true,
      data: {
        glossary: matchedTerms.map((g) => ({ term: g.term, sql: g.sqlExpression, description: g.description })),
        documents: ragChunks,
      },
    };
  }

  private async sqlGenerate(
    userQuery: string,
    schemaContext: string,
    additionalContext: string | undefined,
    dialect: string,
  ): Promise<SkillResult> {
    // Parse schema DDL back to SchemaContext for the generator
    // Since we receive formatted DDL, pass it through as context
    const context: GenerationContext = {
      userQuery: additionalContext ? `${userQuery}\n\n${additionalContext}` : userQuery,
      schema: { tables: [], relationships: [] }, // Schema is in the DDL string
      glossary: [],
      knowledgeContext: [],
      conversationHistory: [],
      fewShotExamples: [],
      dialect,
    };

    // Override the prompt building to include raw DDL
    const result = await this.sqlGenerator.generate({
      ...context,
      userQuery: `${userQuery}\n\nSchema:\n${schemaContext}${additionalContext ? `\n\n补充信息:\n${additionalContext}` : ''}`,
    });

    return { success: true, data: result };
  }

  private async sqlReview(
    userQuery: string,
    sqlStr: string,
    schemaContext: string | undefined,
    datasourceId: string,
  ): Promise<SkillResult> {
    let schema: SchemaContext;
    if (schemaContext) {
      schema = { tables: [], relationships: [] }; // Simplified — verifier uses raw text
    } else {
      schema = await this.schemaLinker.loadSchema(datasourceId);
    }

    const verification = await this.sqlVerifier.verify(userQuery, sqlStr, schema);
    return { success: true, data: verification };
  }

  private async sqlValidate(sqlStr: string): Promise<SkillResult> {
    const validation = this.sqlValidator.validate(sqlStr);
    return { success: true, data: validation };
  }

  private async chartRecommend(
    userQuery: string,
    columns: string | undefined,
  ): Promise<SkillResult> {
    // Use LLM-based chart selection
    const { ChartSelector } = await import('../chart-selector.js');
    const selector = new ChartSelector(
      this.config.anthropicApiKey,
      this.config.anthropicBaseUrl,
    );

    const parsedColumns = columns
      ? columns.split(',').map((c) => {
          const [name, type] = c.trim().split('(');
          return { name: name.trim(), dataType: (type ?? 'unknown').replace(')', '').trim() };
        })
      : [];

    const result = await selector.select(userQuery, parsedColumns, 0);
    return { success: true, data: result };
  }
}
