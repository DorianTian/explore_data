import { z } from 'zod';
import { SQL_DIALECTS, ENGINE_TYPES } from '../constants/dialects.js';

export const connectionConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
  /** PostgreSQL schema for physical tables (e.g. dw_hive) */
  schema: z.string().optional(),
});

export const createDatasourceSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  dialect: z.enum(SQL_DIALECTS),
  engineType: z.enum(ENGINE_TYPES).default('mysql'),
  connectionConfig: connectionConfigSchema.optional(),
});

export const updateDatasourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  engineType: z.enum(ENGINE_TYPES).optional(),
  connectionConfig: connectionConfigSchema.optional(),
});
