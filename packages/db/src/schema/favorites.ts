import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('favorites_project_target_unique').on(t.projectId, t.targetType, t.targetId)],
);
