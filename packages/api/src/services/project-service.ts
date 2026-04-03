import { eq } from 'drizzle-orm';
import { projects, type DbClient } from '@nl2sql/db';

interface CreateProjectInput {
  name: string;
  description?: string;
}

export class ProjectService {
  constructor(private db: DbClient) {}

  async create(input: CreateProjectInput) {
    const [row] = await this.db
      .insert(projects)
      .values({ name: input.name, description: input.description ?? null })
      .returning();
    return row;
  }

  async list() {
    return this.db.select().from(projects).orderBy(projects.createdAt);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(projects).where(eq(projects.id, id));
    return row ?? null;
  }

  async update(id: string, input: Partial<CreateProjectInput>) {
    const [row] = await this.db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(projects).where(eq(projects.id, id)).returning();
    return row !== undefined;
  }
}
