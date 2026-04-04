# Phase 5: BI Market — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight BI marketplace where users can save query visualizations as widgets, compose them into dashboards with a grid layout editor, and browse/favorite/search in a gallery view.

**Architecture:** New DB tables (widgets, dashboards, dashboard_widgets, favorites) → Koa API routes → Zustand dashboard store → Dashboard page with grid editor, gallery view, and save-from-chat integration.

**Tech Stack:** Drizzle ORM (new tables), Koa (new routes), React 19, Zustand, ECharts 6, CSS Grid for dashboard layout

**Prerequisite:** All prior phases complete

---

## Task 1: Database Schema — Widgets, Dashboards, Favorites

**Files:**
- Create: `packages/db/src/schema/widgets.ts`
- Create: `packages/db/src/schema/dashboards.ts`
- Create: `packages/db/src/schema/favorites.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Define widgets table**

```typescript
// packages/db/src/schema/widgets.ts
import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { datasources } from './datasources.js';
import { conversations } from './conversations.js';

export const widgets = pgTable('widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  messageId: uuid('message_id'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  naturalLanguage: text('natural_language').notNull(),
  sql: text('sql').notNull(),
  chartType: varchar('chart_type', { length: 30 }).notNull(),
  chartConfig: jsonb('chart_config').notNull(),
  dataSnapshot: jsonb('data_snapshot'),
  datasourceId: uuid('datasource_id').notNull().references(() => datasources.id),
  isLive: boolean('is_live').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Define dashboards and dashboard_widgets tables**

```typescript
// packages/db/src/schema/dashboards.ts
import { pgTable, uuid, varchar, text, jsonb, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { widgets } from './widgets.js';

export const dashboards = pgTable('dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  layoutConfig: jsonb('layout_config').notNull().$type<{ columns: number }>().default({ columns: 2 }),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  dashboardId: uuid('dashboard_id').notNull().references(() => dashboards.id, { onDelete: 'cascade' }),
  widgetId: uuid('widget_id').notNull().references(() => widgets.id, { onDelete: 'cascade' }),
  positionX: integer('position_x').notNull().default(0),
  positionY: integer('position_y').notNull().default(0),
  width: integer('width').notNull().default(1),
  height: integer('height').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Define favorites table**

```typescript
// packages/db/src/schema/favorites.ts
import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const favorites = pgTable('favorites', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 20 }).notNull(), // 'widget' | 'dashboard'
  targetId: uuid('target_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique('favorites_unique').on(t.projectId, t.targetType, t.targetId),
]);
```

- [ ] **Step 4: Update schema index**

In `packages/db/src/schema/index.ts`, add:

```typescript
export { widgets } from './widgets.js';
export { dashboards, dashboardWidgets } from './dashboards.js';
export { favorites } from './favorites.js';
```

- [ ] **Step 5: Generate and run migration**

Run:
```bash
cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql
pnpm --filter @nl2sql/db drizzle-kit generate
pnpm --filter @nl2sql/db drizzle-kit migrate
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/ packages/db/drizzle/
git commit -m "feat(db): add widgets, dashboards, dashboard_widgets, favorites tables"
```

---

## Task 2: Backend Services

**Files:**
- Create: `packages/api/src/services/widget-service.ts`
- Create: `packages/api/src/services/dashboard-service.ts`
- Create: `packages/api/src/services/favorite-service.ts`

- [ ] **Step 1: Implement WidgetService**

```typescript
// packages/api/src/services/widget-service.ts
import { eq, desc } from 'drizzle-orm';
import type { DbClient } from '@nl2sql/db';
import { widgets } from '@nl2sql/db';

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
    const [widget] = await this.db
      .insert(widgets)
      .values(input)
      .returning();
    return widget;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(widgets)
      .where(eq(widgets.projectId, projectId))
      .orderBy(desc(widgets.createdAt));
  }

  async getById(id: string) {
    const [widget] = await this.db
      .select()
      .from(widgets)
      .where(eq(widgets.id, id));
    return widget ?? null;
  }

  async update(id: string, input: Partial<CreateWidgetInput>) {
    const [widget] = await this.db
      .update(widgets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(widgets.id, id))
      .returning();
    return widget ?? null;
  }

  async remove(id: string) {
    const result = await this.db.delete(widgets).where(eq(widgets.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
```

- [ ] **Step 2: Implement DashboardService**

```typescript
// packages/api/src/services/dashboard-service.ts
import { eq, desc } from 'drizzle-orm';
import type { DbClient } from '@nl2sql/db';
import { dashboards, dashboardWidgets, widgets } from '@nl2sql/db';

interface CreateDashboardInput {
  projectId: string;
  title: string;
  description?: string;
  layoutConfig?: { columns: number };
}

interface AddWidgetInput {
  dashboardId: string;
  widgetId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export class DashboardService {
  constructor(private db: DbClient) {}

  async create(input: CreateDashboardInput) {
    const [dashboard] = await this.db
      .insert(dashboards)
      .values(input)
      .returning();
    return dashboard;
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(dashboards)
      .where(eq(dashboards.projectId, projectId))
      .orderBy(desc(dashboards.updatedAt));
  }

  async getWithWidgets(dashboardId: string) {
    const [dashboard] = await this.db
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, dashboardId));

    if (!dashboard) return null;

    const placements = await this.db
      .select({
        placement: dashboardWidgets,
        widget: widgets,
      })
      .from(dashboardWidgets)
      .innerJoin(widgets, eq(dashboardWidgets.widgetId, widgets.id))
      .where(eq(dashboardWidgets.dashboardId, dashboardId));

    return { dashboard, widgets: placements };
  }

  async update(id: string, input: Partial<CreateDashboardInput>) {
    const [dashboard] = await this.db
      .update(dashboards)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(dashboards.id, id))
      .returning();
    return dashboard ?? null;
  }

  async remove(id: string) {
    const result = await this.db.delete(dashboards).where(eq(dashboards.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async addWidget(input: AddWidgetInput) {
    const [placement] = await this.db
      .insert(dashboardWidgets)
      .values(input)
      .returning();
    return placement;
  }

  async removeWidget(placementId: string) {
    await this.db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, placementId));
  }

  async updateLayout(dashboardId: string, placements: Array<{
    id: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  }>) {
    for (const p of placements) {
      await this.db
        .update(dashboardWidgets)
        .set({
          positionX: p.positionX,
          positionY: p.positionY,
          width: p.width,
          height: p.height,
        })
        .where(eq(dashboardWidgets.id, p.id));
    }
  }
}
```

- [ ] **Step 3: Implement FavoriteService**

```typescript
// packages/api/src/services/favorite-service.ts
import { eq, and } from 'drizzle-orm';
import type { DbClient } from '@nl2sql/db';
import { favorites } from '@nl2sql/db';

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

    const [fav] = await this.db
      .insert(favorites)
      .values({ projectId, targetType, targetId })
      .returning();
    return { favorited: true, id: fav.id };
  }

  async listByProject(projectId: string) {
    return this.db
      .select()
      .from(favorites)
      .where(eq(favorites.projectId, projectId));
  }

  async isFavorited(projectId: string, targetType: string, targetId: string) {
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
    return !!existing;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/widget-service.ts packages/api/src/services/dashboard-service.ts packages/api/src/services/favorite-service.ts
git commit -m "feat(api): add widget, dashboard, and favorite services"
```

---

## Task 3: Backend API Routes

**Files:**
- Create: `packages/api/src/routes/widgets.ts`
- Create: `packages/api/src/routes/dashboards.ts`
- Create: `packages/api/src/routes/favorites.ts`
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: Implement widget routes**

```typescript
// packages/api/src/routes/widgets.ts
import Router from '@koa/router';
import { z } from 'zod';
import { WidgetService } from '../services/widget-service.js';

const createWidgetSchema = z.object({
  projectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  naturalLanguage: z.string().min(1),
  sql: z.string().min(1),
  chartType: z.string().min(1),
  chartConfig: z.unknown(),
  dataSnapshot: z.unknown().optional(),
  datasourceId: z.string().uuid(),
  isLive: z.boolean().optional(),
});

export function createWidgetRoutes(router: Router) {
  router.post('/api/widgets', async (ctx) => {
    const parsed = createWidgetSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }
    const service = new WidgetService(ctx.state.db);
    const widget = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: widget };
  });

  router.get('/api/widgets', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId required' } };
      return;
    }
    const service = new WidgetService(ctx.state.db);
    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });

  router.get('/api/widgets/:id', async (ctx) => {
    const service = new WidgetService(ctx.state.db);
    const widget = await service.getById(ctx.params.id);
    if (!widget) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Widget not found' } };
      return;
    }
    ctx.body = { success: true, data: widget };
  });

  router.patch('/api/widgets/:id', async (ctx) => {
    const service = new WidgetService(ctx.state.db);
    const widget = await service.update(ctx.params.id, ctx.request.body as Record<string, unknown>);
    if (!widget) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Widget not found' } };
      return;
    }
    ctx.body = { success: true, data: widget };
  });

  router.delete('/api/widgets/:id', async (ctx) => {
    const service = new WidgetService(ctx.state.db);
    await service.remove(ctx.params.id);
    ctx.status = 204;
  });
}
```

- [ ] **Step 2: Implement dashboard routes**

```typescript
// packages/api/src/routes/dashboards.ts
import Router from '@koa/router';
import { z } from 'zod';
import { DashboardService } from '../services/dashboard-service.js';

const createDashboardSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  layoutConfig: z.object({ columns: z.number().min(1).max(4) }).optional(),
});

const addWidgetSchema = z.object({
  widgetId: z.string().uuid(),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(1).max(4),
  height: z.number().min(1).max(4),
});

const updateLayoutSchema = z.array(z.object({
  id: z.string().uuid(),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(1).max(4),
  height: z.number().min(1).max(4),
}));

export function createDashboardRoutes(router: Router) {
  router.post('/api/dashboards', async (ctx) => {
    const parsed = createDashboardSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }
    const service = new DashboardService(ctx.state.db);
    const dashboard = await service.create(parsed.data);
    ctx.status = 201;
    ctx.body = { success: true, data: dashboard };
  });

  router.get('/api/dashboards', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId required' } };
      return;
    }
    const service = new DashboardService(ctx.state.db);
    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });

  router.get('/api/dashboards/:id', async (ctx) => {
    const service = new DashboardService(ctx.state.db);
    const result = await service.getWithWidgets(ctx.params.id);
    if (!result) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Dashboard not found' } };
      return;
    }
    ctx.body = { success: true, data: result };
  });

  router.patch('/api/dashboards/:id', async (ctx) => {
    const service = new DashboardService(ctx.state.db);
    const dashboard = await service.update(ctx.params.id, ctx.request.body as Record<string, unknown>);
    if (!dashboard) {
      ctx.status = 404;
      ctx.body = { success: false, error: { code: 'NOT_FOUND', message: 'Dashboard not found' } };
      return;
    }
    ctx.body = { success: true, data: dashboard };
  });

  router.delete('/api/dashboards/:id', async (ctx) => {
    const service = new DashboardService(ctx.state.db);
    await service.remove(ctx.params.id);
    ctx.status = 204;
  });

  // Widget management within dashboard
  router.post('/api/dashboards/:id/widgets', async (ctx) => {
    const parsed = addWidgetSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }
    const service = new DashboardService(ctx.state.db);
    const placement = await service.addWidget({
      dashboardId: ctx.params.id,
      ...parsed.data,
    });
    ctx.status = 201;
    ctx.body = { success: true, data: placement };
  });

  router.delete('/api/dashboards/:dashboardId/widgets/:placementId', async (ctx) => {
    const service = new DashboardService(ctx.state.db);
    await service.removeWidget(ctx.params.placementId);
    ctx.status = 204;
  });

  router.put('/api/dashboards/:id/layout', async (ctx) => {
    const parsed = updateLayoutSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }
    const service = new DashboardService(ctx.state.db);
    await service.updateLayout(ctx.params.id, parsed.data);
    ctx.body = { success: true };
  });
}
```

- [ ] **Step 3: Implement favorites routes**

```typescript
// packages/api/src/routes/favorites.ts
import Router from '@koa/router';
import { z } from 'zod';
import { FavoriteService } from '../services/favorite-service.js';

const toggleFavoriteSchema = z.object({
  projectId: z.string().uuid(),
  targetType: z.enum(['widget', 'dashboard']),
  targetId: z.string().uuid(),
});

export function createFavoriteRoutes(router: Router) {
  router.post('/api/favorites/toggle', async (ctx) => {
    const parsed = toggleFavoriteSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } };
      return;
    }
    const service = new FavoriteService(ctx.state.db);
    const result = await service.toggle(
      parsed.data.projectId,
      parsed.data.targetType,
      parsed.data.targetId,
    );
    ctx.body = { success: true, data: result };
  });

  router.get('/api/favorites', async (ctx) => {
    const projectId = ctx.query.projectId as string;
    if (!projectId) {
      ctx.status = 400;
      ctx.body = { success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId required' } };
      return;
    }
    const service = new FavoriteService(ctx.state.db);
    const list = await service.listByProject(projectId);
    ctx.body = { success: true, data: list };
  });
}
```

- [ ] **Step 4: Register routes in app.ts**

Add to `packages/api/src/app.ts`:

```typescript
import { createWidgetRoutes } from './routes/widgets.js';
import { createDashboardRoutes } from './routes/dashboards.js';
import { createFavoriteRoutes } from './routes/favorites.js';

// In createApp(), after existing route registration:
createWidgetRoutes(router);
createDashboardRoutes(router);
createFavoriteRoutes(router);
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/ packages/api/src/app.ts
git commit -m "feat(api): add widget, dashboard, and favorites API routes"
```

---

## Task 4: Frontend — Dashboard Store

**Files:**
- Create: `packages/web/src/stores/dashboard-store.ts`

- [ ] **Step 1: Create dashboard Zustand store**

```typescript
// packages/web/src/stores/dashboard-store.ts
import { create } from 'zustand';
import { apiFetch, apiPost, apiDelete } from '@/lib/api';

interface Widget {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  naturalLanguage: string;
  sql: string;
  chartType: string;
  chartConfig: unknown;
  dataSnapshot: unknown;
  datasourceId: string;
  isLive: boolean;
  createdAt: string;
}

interface Dashboard {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  layoutConfig: { columns: number };
  createdAt: string;
  updatedAt: string;
}

interface WidgetPlacement {
  placement: { id: string; positionX: number; positionY: number; width: number; height: number };
  widget: Widget;
}

interface Favorite {
  id: string;
  targetType: 'widget' | 'dashboard';
  targetId: string;
}

interface DashboardState {
  widgets: Widget[];
  dashboards: Dashboard[];
  favorites: Favorite[];
  currentDashboard: { dashboard: Dashboard; widgets: WidgetPlacement[] } | null;
  loading: boolean;
}

interface DashboardActions {
  fetchWidgets: (projectId: string) => Promise<void>;
  fetchDashboards: (projectId: string) => Promise<void>;
  fetchFavorites: (projectId: string) => Promise<void>;
  fetchDashboard: (id: string) => Promise<void>;
  createWidget: (input: Omit<Widget, 'id' | 'createdAt'>) => Promise<Widget | null>;
  createDashboard: (input: { projectId: string; title: string; description?: string }) => Promise<Dashboard | null>;
  deleteDashboard: (id: string) => Promise<void>;
  deleteWidget: (id: string) => Promise<void>;
  toggleFavorite: (projectId: string, targetType: string, targetId: string) => Promise<void>;
  isFavorited: (targetId: string) => boolean;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  widgets: [],
  dashboards: [],
  favorites: [],
  currentDashboard: null,
  loading: false,

  fetchWidgets: async (projectId) => {
    const res = await apiFetch<Widget[]>(`/api/widgets?projectId=${projectId}`);
    if (res.success && res.data) set({ widgets: res.data });
  },

  fetchDashboards: async (projectId) => {
    const res = await apiFetch<Dashboard[]>(`/api/dashboards?projectId=${projectId}`);
    if (res.success && res.data) set({ dashboards: res.data });
  },

  fetchFavorites: async (projectId) => {
    const res = await apiFetch<Favorite[]>(`/api/favorites?projectId=${projectId}`);
    if (res.success && res.data) set({ favorites: res.data });
  },

  fetchDashboard: async (id) => {
    set({ loading: true });
    const res = await apiFetch<{ dashboard: Dashboard; widgets: WidgetPlacement[] }>(`/api/dashboards/${id}`);
    if (res.success && res.data) set({ currentDashboard: res.data });
    set({ loading: false });
  },

  createWidget: async (input) => {
    const res = await apiPost<Widget>('/api/widgets', input);
    if (res.success && res.data) {
      set((s) => ({ widgets: [res.data!, ...s.widgets] }));
      return res.data;
    }
    return null;
  },

  createDashboard: async (input) => {
    const res = await apiPost<Dashboard>('/api/dashboards', input);
    if (res.success && res.data) {
      set((s) => ({ dashboards: [res.data!, ...s.dashboards] }));
      return res.data;
    }
    return null;
  },

  deleteDashboard: async (id) => {
    await apiDelete(`/api/dashboards/${id}`);
    set((s) => ({ dashboards: s.dashboards.filter((d) => d.id !== id) }));
  },

  deleteWidget: async (id) => {
    await apiDelete(`/api/widgets/${id}`);
    set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) }));
  },

  toggleFavorite: async (projectId, targetType, targetId) => {
    const res = await apiPost<{ favorited: boolean }>('/api/favorites/toggle', {
      projectId, targetType, targetId,
    });
    if (res.success) {
      // Refresh favorites
      get().fetchFavorites(projectId);
    }
  },

  isFavorited: (targetId) => {
    return get().favorites.some((f) => f.targetId === targetId);
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/stores/dashboard-store.ts
git commit -m "feat(web): add dashboard store for widgets, dashboards, and favorites"
```

---

## Task 5: Save Widget from Chat

**Files:**
- Create: `packages/web/src/components/dashboard/save-widget-dialog.tsx`
- Modify: `packages/web/src/components/chat/message-feedback.tsx`

- [ ] **Step 1: Create save-widget dialog**

```typescript
// packages/web/src/components/dashboard/save-widget-dialog.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter, Button, Input } from '@/components/ui';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useProjectStore } from '@/stores/project-store';
import type { ChatMessage } from '@/stores/chat-store';

interface SaveWidgetDialogProps {
  open: boolean;
  onClose: () => void;
  message: ChatMessage;
}

export function SaveWidgetDialog({ open, onClose, message }: SaveWidgetDialogProps) {
  const [title, setTitle] = useState(message.content.slice(0, 50));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { createWidget } = useDashboardStore();
  const { currentProjectId, currentDatasourceId } = useProjectStore();

  const handleSave = async () => {
    if (!currentProjectId || !currentDatasourceId || !message.sql) return;
    setSaving(true);

    await createWidget({
      projectId: currentProjectId,
      datasourceId: currentDatasourceId,
      title,
      description: description || null,
      naturalLanguage: message.content,
      sql: message.sql,
      chartType: message.chartRecommendation?.chartType ?? 'table',
      chartConfig: message.chartRecommendation?.config ?? {},
      dataSnapshot: message.executionResult ?? null,
      isLive: true,
    });

    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>保存为 Widget</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">标题</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">描述（可选）</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="添加描述..." />
        </div>
        <div className="text-xs text-muted">
          <p>SQL: {message.sql?.slice(0, 80)}...</p>
          <p>图表类型: {message.chartRecommendation?.chartType ?? 'table'}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add save button to message feedback**

In `packages/web/src/components/chat/message-feedback.tsx`, add a save button after the golden star:

```typescript
// Add import at top:
import { useState } from 'react';
import { SaveWidgetDialog } from '@/components/dashboard/save-widget-dialog';
import type { ChatMessage } from '@/stores/chat-store';

// Add to MessageFeedbackProps:
message?: ChatMessage;

// Add inside the component, after the golden star button:
const [showSaveDialog, setShowSaveDialog] = useState(false);

// In JSX, after the golden star tooltip:
{sql && (
  <Tooltip content="保存为 Widget">
    <button
      onClick={() => setShowSaveDialog(true)}
      className="p-1.5 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
    >
      <Icon name="save" size={14} />
    </button>
  </Tooltip>
)}

{showSaveDialog && message && (
  <SaveWidgetDialog
    open={showSaveDialog}
    onClose={() => setShowSaveDialog(false)}
    message={message}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/dashboard/save-widget-dialog.tsx packages/web/src/components/chat/message-feedback.tsx
git commit -m "feat(web): add save-to-widget flow from chat messages"
```

---

## Task 6: Dashboard Gallery Page

**Files:**
- Create: `packages/web/src/app/dashboard/page.tsx`
- Create: `packages/web/src/components/dashboard/gallery-view.tsx`
- Create: `packages/web/src/components/dashboard/widget-card.tsx`

- [ ] **Step 1: Create widget card component**

```typescript
// packages/web/src/components/dashboard/widget-card.tsx
'use client';

import dynamic from 'next/dynamic';
import { Icon } from '@/components/shared/icon';
import { Badge, DropdownMenu, DropdownMenuItem } from '@/components/ui';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useProjectStore } from '@/stores/project-store';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface WidgetCardProps {
  widget: {
    id: string;
    title: string;
    description: string | null;
    chartType: string;
    chartConfig: unknown;
    naturalLanguage: string;
    createdAt: string;
  };
  onDelete?: () => void;
}

export function WidgetCard({ widget, onDelete }: WidgetCardProps) {
  const { toggleFavorite, isFavorited } = useDashboardStore();
  const { currentProjectId } = useProjectStore();
  const favorited = isFavorited(widget.id);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-background overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group">
      {/* Chart preview */}
      <div className="h-[160px] bg-surface/50 flex items-center justify-center overflow-hidden">
        {widget.chartType === 'kpi' ? (
          <div className="text-center">
            <p className="text-xs text-muted">{(widget.chartConfig as Record<string, Record<string, string>>)?.title?.text}</p>
            <p className="text-3xl font-bold text-foreground">
              {String(((widget.chartConfig as Record<string, Array<{ data: unknown[] }>>)?.series)?.[0]?.data?.[0] ?? '—')}
            </p>
          </div>
        ) : (
          <ReactECharts
            option={widget.chartConfig as Record<string, unknown>}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'svg' }}
            notMerge
          />
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-medium text-foreground text-sm truncate flex-1">{widget.title}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => currentProjectId && toggleFavorite(currentProjectId, 'widget', widget.id)}
              className="p-1 cursor-pointer"
            >
              <Icon
                name={favorited ? 'starFilled' : 'star'}
                size={14}
                className={favorited ? 'text-[var(--golden)]' : 'text-muted hover:text-foreground'}
              />
            </button>
            <DropdownMenu
              trigger={
                <button className="p-1 text-muted hover:text-foreground cursor-pointer">
                  <Icon name="ellipsis" size={14} />
                </button>
              }
              align="right"
            >
              <DropdownMenuItem onClick={onDelete} variant="danger">
                删除
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted truncate">{widget.naturalLanguage}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="default">{widget.chartType}</Badge>
          <span className="text-xs text-muted">{new Date(widget.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create gallery view**

```typescript
// packages/web/src/components/dashboard/gallery-view.tsx
'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetCard } from './widget-card';
import { Button, Input } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

type GalleryTab = 'widgets' | 'dashboards' | 'favorites';

export function GalleryView() {
  const { currentProjectId } = useProjectStore();
  const { widgets, dashboards, favorites, fetchWidgets, fetchDashboards, fetchFavorites, deleteWidget, deleteDashboard } = useDashboardStore();
  const [tab, setTab] = useState<GalleryTab>('widgets');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentProjectId) {
      fetchWidgets(currentProjectId);
      fetchDashboards(currentProjectId);
      fetchFavorites(currentProjectId);
    }
  }, [currentProjectId, fetchWidgets, fetchDashboards, fetchFavorites]);

  const filteredWidgets = widgets.filter((w) =>
    !search || w.title.toLowerCase().includes(search.toLowerCase()) || w.naturalLanguage.toLowerCase().includes(search.toLowerCase()),
  );

  const favoriteWidgetIds = new Set(favorites.filter((f) => f.targetType === 'widget').map((f) => f.targetId));
  const favoritedWidgets = widgets.filter((w) => favoriteWidgetIds.has(w.id));

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border pb-3">
        {(['widgets', 'dashboards', 'favorites'] as GalleryTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
              tab === t
                ? 'text-foreground border-primary'
                : 'text-muted border-transparent hover:text-foreground'
            }`}
          >
            {t === 'widgets' ? `Widgets (${widgets.length})` : t === 'dashboards' ? `看板 (${dashboards.length})` : `收藏 (${favoritedWidgets.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="搜索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Grid */}
      {tab === 'widgets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onDelete={() => deleteWidget(w.id)} />
          ))}
          {filteredWidgets.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted">
              <Icon name="layout" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无 Widget</p>
              <p className="text-xs mt-1">在对话中点击保存按钮创建 Widget</p>
            </div>
          )}
        </div>
      )}

      {tab === 'dashboards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => (
            <div
              key={d.id}
              className="p-5 rounded-[var(--radius-lg)] border border-border bg-background hover:shadow-md transition-all cursor-pointer"
            >
              <h3 className="font-medium text-foreground mb-1">{d.title}</h3>
              <p className="text-xs text-muted">{d.description}</p>
              <span className="text-xs text-muted mt-2 block">{new Date(d.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'favorites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoritedWidgets.map((w) => (
            <WidgetCard key={w.id} widget={w} />
          ))}
          {favoritedWidgets.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted text-sm">
              暂无收藏
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard page**

```typescript
// packages/web/src/app/dashboard/page.tsx
'use client';

import { AppShell } from '@/components/layout/app-shell';
import { GalleryView } from '@/components/dashboard/gallery-view';
import { ToastProvider } from '@/components/toast';

export default function DashboardPage() {
  return (
    <AppShell>
      <ToastProvider>
        <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">BI 看板市场</h2>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <GalleryView />
        </div>
      </ToastProvider>
    </AppShell>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/dashboard/ packages/web/src/components/dashboard/
git commit -m "feat(web): add BI gallery page with widget cards, search, and favorites"
```

---

## Task 7: Dashboard Detail Page with Grid Editor

**Files:**
- Create: `packages/web/src/app/dashboard/[id]/page.tsx`
- Create: `packages/web/src/components/dashboard/dashboard-grid.tsx`
- Create: `packages/web/src/components/dashboard/dashboard-editor.tsx`

- [ ] **Step 1: Create dashboard grid layout component**

```typescript
// packages/web/src/components/dashboard/dashboard-grid.tsx
'use client';

import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface GridWidget {
  placementId: string;
  widgetId: string;
  title: string;
  chartType: string;
  chartConfig: unknown;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

interface DashboardGridProps {
  widgets: GridWidget[];
  columns: number;
  editable?: boolean;
  onRemove?: (placementId: string) => void;
}

export function DashboardGrid({ widgets, columns, editable, onRemove }: DashboardGridProps) {
  // Find grid dimensions
  const maxY = widgets.reduce((max, w) => Math.max(max, w.positionY + w.height), 0);

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: '200px',
      }}
    >
      {widgets.map((w) => (
        <div
          key={w.placementId}
          className="rounded-[var(--radius-lg)] border border-border bg-background overflow-hidden relative group"
          style={{
            gridColumn: `${w.positionX + 1} / span ${w.width}`,
            gridRow: `${w.positionY + 1} / span ${w.height}`,
          }}
        >
          {/* Title */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h4 className="text-xs font-medium text-foreground truncate">{w.title}</h4>
            {editable && onRemove && (
              <button
                onClick={() => onRemove(w.placementId)}
                className="text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs"
              >
                移除
              </button>
            )}
          </div>

          {/* Chart */}
          <div className="flex-1 p-2 h-[calc(100%-36px)]">
            {w.chartType === 'kpi' ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-3xl font-bold text-foreground">
                  {String(((w.chartConfig as Record<string, Array<{ data: unknown[] }>>)?.series)?.[0]?.data?.[0] ?? '—')}
                </p>
              </div>
            ) : (
              <ReactECharts
                option={w.chartConfig as Record<string, unknown>}
                style={{ height: '100%', width: '100%' }}
                opts={{ renderer: 'svg' }}
                notMerge
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create dashboard detail page**

```typescript
// packages/web/src/app/dashboard/[id]/page.tsx
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardGrid } from '@/components/dashboard/dashboard-grid';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { ToastProvider } from '@/components/toast';

export default function DashboardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentDashboard, fetchDashboard, loading } = useDashboardStore();

  useEffect(() => {
    if (params.id) fetchDashboard(params.id as string);
  }, [params.id, fetchDashboard]);

  const gridWidgets = currentDashboard?.widgets.map((pw) => ({
    placementId: pw.placement.id,
    widgetId: pw.widget.id,
    title: pw.widget.title,
    chartType: pw.widget.chartType,
    chartConfig: pw.widget.chartConfig,
    positionX: pw.placement.positionX,
    positionY: pw.placement.positionY,
    width: pw.placement.width,
    height: pw.placement.height,
  })) ?? [];

  return (
    <AppShell>
      <ToastProvider>
        <header className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-muted hover:text-foreground cursor-pointer">
              <Icon name="chevronLeft" size={18} />
            </button>
            <h2 className="text-base font-semibold text-foreground">
              {currentDashboard?.dashboard.title ?? '加载中...'}
            </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted text-center py-8">加载中...</p>
          ) : gridWidgets.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Icon name="layout" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">看板为空</p>
              <p className="text-xs mt-1">在 Widget 列表中添加到此看板</p>
            </div>
          ) : (
            <DashboardGrid
              widgets={gridWidgets}
              columns={currentDashboard?.dashboard.layoutConfig?.columns ?? 2}
              editable
            />
          )}
        </div>
      </ToastProvider>
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/dashboard/ packages/web/src/components/dashboard/dashboard-grid.tsx
git commit -m "feat(web): add dashboard detail page with CSS Grid layout rendering"
```

---

## Task 8: Verify Phase 5

- [ ] **Step 1: Full build**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm build`
Expected: All packages build.

- [ ] **Step 2: Manual verification**

- [ ] Save a widget from chat (click save button on an assistant message with SQL)
- [ ] Navigate to /dashboard — see the widget in gallery
- [ ] Search widgets
- [ ] Favorite a widget
- [ ] View favorites tab
- [ ] Create a dashboard
- [ ] Navigate to dashboard detail page
- [ ] Verify grid layout renders correctly

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 5 — BI Market with widgets, dashboards, favorites, gallery, and grid layout"
```
