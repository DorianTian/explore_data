import { eq } from 'drizzle-orm';
import { datasources, type DbClient } from '@nl2sql/db';

interface CreateDatasourceInput {
  projectId: string;
  name: string;
  dialect: string;
  engineType?: string;
  connectionConfig?: Record<string, unknown>;
}

export class DatasourceService {
  constructor(private db: DbClient) {}

  async create(input: CreateDatasourceInput) {
    const [row] = await this.db
      .insert(datasources)
      .values({
        projectId: input.projectId,
        name: input.name,
        dialect: input.dialect,
        engineType: input.engineType ?? 'mysql',
        connectionConfig: input.connectionConfig ?? null,
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(datasources)
      .where(eq(datasources.projectId, projectId))
      .orderBy(datasources.createdAt);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(datasources).where(eq(datasources.id, id));
    return row ?? null;
  }

  async update(id: string, input: { name?: string; engineType?: string; connectionConfig?: unknown }) {
    const [row] = await this.db
      .update(datasources)
      .set(input)
      .where(eq(datasources.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(datasources).where(eq(datasources.id, id)).returning();
    return row !== undefined;
  }
}
