import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { widgets } from './widgets.js';

export const dashboards = pgTable('dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  layoutConfig: jsonb('layout_config').default({ columns: 2 }).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  dashboardId: uuid('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  widgetId: uuid('widget_id')
    .notNull()
    .references(() => widgets.id, { onDelete: 'cascade' }),
  positionX: integer('position_x').default(0).notNull(),
  positionY: integer('position_y').default(0).notNull(),
  width: integer('width').default(1).notNull(),
  height: integer('height').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
