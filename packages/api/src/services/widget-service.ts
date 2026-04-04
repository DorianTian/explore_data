import { eq, desc } from 'drizzle-orm';
import { widgets, type DbClient } from '@nl2sql/db';

interface CreateWidgetInput {
  projectId: string;
  conversationId?: string;
  messageId?: string;
  title: string;
  description?: string;
  naturalLanguage: string;
  sql: string;
  chartType: string;
  chartConfig: unknown;
  dataSnapshot?: unknown;
  datasourceId: string;
  isLive?: boolean;
}

export class WidgetService {
  constructor(private db: DbClient) {}

  async create(input: CreateWidgetInput) {
    const [row] = await this.db
      .insert(widgets)
      .values({
        projectId: input.projectId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        title: input.title,
        description: input.description ?? null,
        naturalLanguage: input.naturalLanguage,
        sql: input.sql,
        chartType: input.chartType,
        chartConfig: input.chartConfig,
        dataSnapshot: input.dataSnapshot ?? null,
        datasourceId: input.datasourceId,
        isLive: input.isLive ?? true,
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(widgets)
      .where(eq(widgets.projectId, projectId))
      .orderBy(desc(widgets.createdAt));
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(widgets).where(eq(widgets.id, id));
    return row ?? null;
  }

  async update(id: string, input: Partial<Omit<CreateWidgetInput, 'projectId'>>) {
    const [row] = await this.db
      .update(widgets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(widgets.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(widgets).where(eq(widgets.id, id)).returning();
    return row !== undefined;
  }
}
