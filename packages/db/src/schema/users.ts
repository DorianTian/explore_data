import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const accounts = pgTable('app_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
