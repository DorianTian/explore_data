# NL2SQL v2 — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade NL2SQL from prototype to enterprise-grade product — new UI, right panel, 1000-table seed, landing page, and BI marketplace.

**Architecture:** 5 phases executed sequentially. Each phase has its own plan file, producible and testable independently. Phases share a common design system and database schema evolution path.

**Tech Stack:** Next.js 16 + React 19 + Tailwind 4, Koa 3 + Drizzle ORM + PostgreSQL + pgvector, ECharts 6, Zustand 5, Monaco Editor, Anthropic SDK + OpenAI SDK

---

## Phase Dependency Graph

```
Phase 1: UI Restructure (Feature 4)
    └─→ Phase 2: Right Panel (Feature 2)
            └─→ Phase 3: Seed Data (Feature 3)
                    ├─→ Phase 4: Landing Page (Feature 1)
                    └─→ Phase 5: BI Market (Feature 5)
```

## Plan Files

| Phase | File | Est. Tasks |
|-------|------|-----------|
| 1 | `2026-04-04-phase1-ui-restructure.md` | 12 |
| 2 | `2026-04-04-phase2-right-panel.md` | 10 |
| 3 | `2026-04-04-phase3-seed-data.md` | 14 |
| 4 | `2026-04-04-phase4-landing-page.md` | 6 |
| 5 | `2026-04-04-phase5-bi-market.md` | 12 |

## Cross-Phase Schema Evolution

### New DB Tables (Phase 5)

```sql
-- widgets: saved query visualizations
CREATE TABLE widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  natural_language TEXT NOT NULL,
  sql TEXT NOT NULL,
  chart_type VARCHAR(30) NOT NULL,
  chart_config JSONB NOT NULL,
  data_snapshot JSONB,
  datasource_id UUID NOT NULL REFERENCES datasources(id),
  is_live BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- dashboards: dashboard containers
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  layout_config JSONB NOT NULL DEFAULT '{"columns": 2}',
  is_public BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- dashboard_widgets: placement of widgets on dashboards
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_id UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- favorites: user bookmarks
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL, -- 'widget' | 'dashboard'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, target_type, target_id)
);
```

### Schema Modifications (Phase 1)

```sql
-- query_history: extend feedback model
ALTER TABLE query_history ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE query_history ADD COLUMN is_golden BOOLEAN DEFAULT false NOT NULL;
-- Migrate: UPDATE query_history SET status = CASE WHEN was_accepted > 0.5 THEN 'accepted' ELSE 'pending' END;
```

## New File Structure (Final State)

```
packages/web/src/
├── app/
│   ├── layout.tsx                    (modified: new shell layout)
│   ├── page.tsx                      (modified: chat with panel)
│   ├── globals.css                   (modified: design system v2)
│   ├── landing/page.tsx              (new: landing page)
│   ├── dashboard/
│   │   ├── page.tsx                  (new: BI gallery)
│   │   └── [id]/page.tsx            (new: dashboard detail)
│   ├── schema/page.tsx              (existing)
│   ├── metrics/page.tsx             (existing)
│   └── knowledge/page.tsx           (existing)
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx            (new: sidebar + main + panel)
│   │   ├── sidebar.tsx              (modified: conversations list)
│   │   └── panel.tsx                (new: right panel container)
│   ├── chat/
│   │   ├── chat-message.tsx         (modified: rich message)
│   │   ├── chat-input.tsx           (existing)
│   │   ├── message-sql-block.tsx    (new: expandable SQL)
│   │   ├── message-result-preview.tsx (new: result thumbnail)
│   │   ├── message-chart-preview.tsx  (new: chart thumbnail)
│   │   ├── message-feedback.tsx     (new: tri-state feedback)
│   │   ├── follow-up-suggestions.tsx (new: suggested questions)
│   │   └── streaming-indicator.tsx  (new: pipeline status)
│   ├── panel/
│   │   ├── panel-tabs.tsx           (new: tab switcher)
│   │   ├── detail-tab.tsx           (new: SQL editor + results)
│   │   ├── schema-tab.tsx           (new: tree browser)
│   │   ├── history-tab.tsx          (new: query history)
│   │   ├── sql-editor.tsx           (new: Monaco wrapper)
│   │   └── schema-tree.tsx          (new: tree component)
│   ├── dashboard/
│   │   ├── dashboard-grid.tsx       (new: grid layout)
│   │   ├── widget-card.tsx          (new: widget display)
│   │   ├── gallery-view.tsx         (new: card grid)
│   │   ├── save-widget-dialog.tsx   (new: save from chat)
│   │   └── dashboard-editor.tsx     (new: edit layout)
│   ├── landing/
│   │   ├── hero.tsx                 (new)
│   │   ├── feature-showcase.tsx     (new)
│   │   ├── demo-section.tsx         (new)
│   │   └── cta-section.tsx          (new)
│   ├── shared/
│   │   ├── sql-result-table.tsx     (modified: sortable, exportable)
│   │   ├── chart-view.tsx           (modified: interactive mode)
│   │   ├── toast.tsx                (existing)
│   │   ├── icon.tsx                 (new: icon system)
│   │   └── tree-view.tsx            (new: generic tree)
│   └── ui/                          (new: design system primitives)
│       ├── button.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── tabs.tsx
│       ├── dialog.tsx
│       ├── badge.tsx
│       ├── tooltip.tsx
│       └── dropdown-menu.tsx
├── hooks/
│   ├── use-sse-stream.ts           (new: SSE streaming)
│   ├── use-panel.ts                (new: panel state)
│   └── use-keyboard.ts             (new: keyboard shortcuts)
├── lib/
│   ├── api.ts                      (modified: new endpoints)
│   └── sse.ts                      (new: SSE client)
└── stores/
    ├── chat-store.ts               (modified: selectedMessage, streaming)
    ├── project-store.ts            (modified: conversations list)
    ├── schema-store.ts             (existing)
    ├── panel-store.ts              (new: panel UI state)
    └── dashboard-store.ts          (new: BI state)

packages/api/src/
├── routes/
│   ├── widgets.ts                  (new)
│   ├── dashboards.ts               (new)
│   └── favorites.ts                (new)
├── services/
│   ├── widget-service.ts           (new)
│   ├── dashboard-service.ts        (new)
│   └── favorite-service.ts         (new)
└── seed/                           (new: seed generator)
    ├── index.ts                    (orchestrator)
    ├── generator.ts                (DDL generator engine)
    ├── domains/
    │   ├── types.ts                (domain definition schema)
    │   ├── ecommerce.ts            (~200 tables)
    │   ├── finance.ts              (~170 tables)
    │   ├── user-growth.ts          (~130 tables)
    │   ├── supply-chain.ts         (~170 tables)
    │   ├── marketing.ts            (~150 tables)
    │   ├── crm-content.ts          (~100 tables)
    │   └── data-governance.ts      (~80 tables)
    ├── metrics/                    (per-domain metrics)
    ├── knowledge/                  (glossary + docs)
    └── conversations/              (sample conversations)

packages/db/src/schema/
├── widgets.ts                      (new)
├── dashboards.ts                   (new)
└── favorites.ts                    (new)
```

## Execution Strategy

Start with Phase 1. Each phase should be committed as a logical unit. Use `superpowers:subagent-driven-development` to dispatch tasks within each phase.

**Validation checkpoints between phases:**
- Phase 1 → 2: `pnpm build` passes, chat page renders with new layout, streaming works end-to-end
- Phase 2 → 3: Panel opens/closes, Monaco loads, schema tree renders, history loads
- Phase 3 → 4: `pnpm db:seed` creates 1000+ tables across 7 datasources, all metrics/glossary created
- Phase 4 → 5: Landing page accessible at `/landing`, links to chat work
- Phase 5 done: Widgets saveable from chat, dashboards editable, gallery browsable
