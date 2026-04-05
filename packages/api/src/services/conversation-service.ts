import { eq, and, desc } from 'drizzle-orm';
import { conversations, messages, queryHistory, type DbClient } from '@nl2sql/db';

interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  generatedSql?: string;
  executionResult?: unknown;
  chartConfig?: unknown;
  confidence?: number;
  schemaUsed?: unknown;
  metricsUsed?: string[];
}

export class ConversationService {
  constructor(private db: DbClient) {}

  async createConversation(projectId: string, title?: string, userId?: string) {
    const [row] = await this.db
      .insert(conversations)
      .values({ projectId, title: title ?? null, userId: userId ?? null })
      .returning();
    return row;
  }

  async listConversations(projectId: string, userId?: string) {
    const conditions = [eq(conversations.projectId, projectId)];
    if (userId) conditions.push(eq(conversations.userId, userId));

    return this.db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(conversationId: string) {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conv) return null;

    const msgs = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return { conversation: conv, messages: msgs };
  }

  async addMessage(input: CreateMessageInput) {
    const [msg] = await this.db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        generatedSql: input.generatedSql ?? null,
        executionResult: input.executionResult ?? null,
        chartConfig: input.chartConfig ?? null,
        confidence: input.confidence ?? null,
        schemaUsed: input.schemaUsed ?? null,
        metricsUsed: input.metricsUsed ?? null,
      })
      .returning();

    // Update conversation timestamp
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, input.conversationId));

    return msg;
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(conversations)
      .where(eq(conversations.id, conversationId))
      .returning();
    return row !== undefined;
  }

  /** Record a query for the data flywheel */
  async recordQuery(
    projectId: string,
    input: {
      naturalLanguage: string;
      generatedSql: string;
      correctedSql?: string;
      wasAccepted?: number;
      status?: string;
      isGolden?: boolean;
      tablesUsed?: string[];
      columnsUsed?: string[];
    },
  ) {
    const [row] = await this.db
      .insert(queryHistory)
      .values({
        projectId,
        naturalLanguage: input.naturalLanguage,
        generatedSql: input.generatedSql,
        correctedSql: input.correctedSql ?? null,
        wasAccepted: input.wasAccepted ?? null,
        status: input.status ?? 'pending',
        isGolden: input.isGolden ?? false,
        tablesUsed: input.tablesUsed ?? null,
        columnsUsed: input.columnsUsed ?? null,
      })
      .returning();
    return row;
  }

  /** List query history for a project */
  async listQueryHistory(projectId: string) {
    return this.db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.projectId, projectId))
      .orderBy(desc(queryHistory.createdAt))
      .limit(100);
  }
}
