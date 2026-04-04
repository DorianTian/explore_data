import { eq, desc } from 'drizzle-orm';
import { dashboards, dashboardWidgets, widgets, type DbClient } from '@nl2sql/db';

interface CreateDashboardInput {
  projectId: string;
  title: string;
  description?: string;
  layoutConfig?: unknown;
  isPublic?: boolean;
}

interface AddWidgetInput {
  widgetId: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
}

interface LayoutItem {
  id: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export class DashboardService {
  constructor(private db: DbClient) {}

  async create(input: CreateDashboardInput) {
    const [row] = await this.db
      .insert(dashboards)
      .values({
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? null,
        layoutConfig: input.layoutConfig ?? { columns: 2 },
        isPublic: input.isPublic ?? false,
      })
      .returning();
    return row;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(dashboards)
      .where(eq(dashboards.projectId, projectId))
      .orderBy(desc(dashboards.createdAt));
  }

  async getWithWidgets(id: string) {
    const [dashboard] = await this.db.select().from(dashboards).where(eq(dashboards.id, id));
    if (!dashboard) return null;

    const placements = await this.db
      .select({
        placement: dashboardWidgets,
        widget: widgets,
      })
      .from(dashboardWidgets)
      .innerJoin(widgets, eq(dashboardWidgets.widgetId, widgets.id))
      .where(eq(dashboardWidgets.dashboardId, id));

    return { dashboard, widgets: placements };
  }

  async update(id: string, input: Partial<Omit<CreateDashboardInput, 'projectId'>>) {
    const [row] = await this.db
      .update(dashboards)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(dashboards.id, id))
      .returning();
    return row ?? null;
  }

  async remove(id: string): Promise<boolean> {
    const [row] = await this.db.delete(dashboards).where(eq(dashboards.id, id)).returning();
    return row !== undefined;
  }

  async addWidget(dashboardId: string, input: AddWidgetInput) {
    const [row] = await this.db
      .insert(dashboardWidgets)
      .values({
        dashboardId,
        widgetId: input.widgetId,
        positionX: input.positionX ?? 0,
        positionY: input.positionY ?? 0,
        width: input.width ?? 1,
        height: input.height ?? 1,
      })
      .returning();
    return row;
  }

  async removeWidget(placementId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(dashboardWidgets)
      .where(eq(dashboardWidgets.id, placementId))
      .returning();
    return row !== undefined;
  }

  async updateLayout(dashboardId: string, items: LayoutItem[]) {
    const results = await Promise.all(
      items.map((item) =>
        this.db
          .update(dashboardWidgets)
          .set({
            positionX: item.positionX,
            positionY: item.positionY,
            width: item.width,
            height: item.height,
          })
          .where(eq(dashboardWidgets.id, item.id))
          .returning(),
      ),
    );

    await this.db
      .update(dashboards)
      .set({ updatedAt: new Date() })
      .where(eq(dashboards.id, dashboardId));

    return results.flat();
  }
}
