import { eq, and } from 'drizzle-orm';
import { favorites, type DbClient } from '@nl2sql/db';

export class FavoriteService {
  constructor(private db: DbClient) {}

  async toggle(projectId: string, targetType: string, targetId: string) {
    const [existing] = await this.db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.projectId, projectId),
          eq(favorites.targetType, targetType),
          eq(favorites.targetId, targetId),
        ),
      );

    if (existing) {
      await this.db.delete(favorites).where(eq(favorites.id, existing.id));
      return { favorited: false };
    }

    const [row] = await this.db
      .insert(favorites)
      .values({ projectId, targetType, targetId })
      .returning();
    return { favorited: true, data: row };
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(favorites)
      .where(eq(favorites.projectId, projectId))
      .orderBy(favorites.createdAt);
  }

  async isFavorited(projectId: string, targetType: string, targetId: string): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.projectId, projectId),
          eq(favorites.targetType, targetType),
          eq(favorites.targetId, targetId),
        ),
      );
    return row !== undefined;
  }
}
