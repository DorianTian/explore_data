import { eq, and } from 'drizzle-orm';
import { metrics, type DbClient } from '@nl2sql/db';
import type { z } from 'zod';
import type { createMetricSchema, updateMetricSchema } from '@nl2sql/shared';

type CreateMetricInput = z.infer<typeof createMetricSchema>;
type UpdateMetricInput = z.infer<typeof updateMetricSchema>;

export class MetricService {
  constructor(private db: DbClient) {}

  async create(input: CreateMetricInput) {
    const [row] = await this.db
      .insert(metrics)
      .values({
        projectId: input.projectId,
        name: input.name,
        displayName: input.displayName,
        description: input.description ?? null,
        expression: input.expression,
        metricType: input.metricType,
        sourceTableId: input.sourceTableId ?? null,
        filters: input.filters ?? null,
        dimensions: input.dimensions ?? null,
        granularity: input.granularity ?? null,
        derivedFrom: input.derivedFrom ?? null,
        format: input.format ?? 'number',
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(metrics)
      .where(eq(metrics.projectId, projectId))
      .orderBy(metrics.name);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(metrics).where(eq(metrics.id, id));
    return row ?? null;
  }

  /** Resolve a metric by name within a project (used by NL2SQL engine) */
  async findByName(projectId: string, name: string) {
    const [row] = await this.db
      .select()
      .from(metrics)
      .where(and(eq(metrics.projectId, projectId), eq(metrics.name, name)));
    return row ?? null;
  }

  async update(id: string, input: UpdateMetricInput) {
    const [row] = await this.db
      .update(metrics)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(metrics.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(metrics)
      .where(eq(metrics.id, id))
      .returning();
    return row !== undefined;
  }

  /**
   * Compose SQL from a metric definition + user-specified dimensions and time range.
   * This is the core of the "指标组装" approach — no LLM needed for known metrics.
   */
  composeSql(metric: typeof metrics.$inferSelect, params: {
    dimensions?: string[];
    timeColumn?: string;
    timeRange?: { start: string; end: string };
    orderBy?: string;
    limit?: number;
  }): string {
    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    if (params.dimensions) {
      for (const dim of params.dimensions) {
        selectParts.push(dim);
        groupByParts.push(dim);
      }
    }

    selectParts.push(`${metric.expression} AS ${metric.name}`);

    const whereParts: string[] = [];
    if (metric.filters && Array.isArray(metric.filters)) {
      for (const f of metric.filters as Array<{ column: string; op: string; value: unknown }>) {
        const val = typeof f.value === 'string' ? `'${f.value}'` : String(f.value);
        whereParts.push(`${f.column} ${f.op} ${val}`);
      }
    }

    if (params.timeColumn && params.timeRange) {
      whereParts.push(
        `${params.timeColumn} >= '${params.timeRange.start}'`,
      );
      whereParts.push(
        `${params.timeColumn} < '${params.timeRange.end}'`,
      );
    }

    let sql = `SELECT ${selectParts.join(', ')}`;

    // TODO: resolve source table name from sourceTableId in engine layer
    sql += ` FROM {{source_table}}`;

    if (whereParts.length > 0) {
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }

    if (groupByParts.length > 0) {
      sql += ` GROUP BY ${groupByParts.join(', ')}`;
    }

    if (params.orderBy) {
      sql += ` ORDER BY ${params.orderBy}`;
    }

    if (params.limit) {
      sql += ` LIMIT ${params.limit}`;
    }

    return sql;
  }
}
