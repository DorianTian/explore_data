import { z } from 'zod';

const metricFilterSchema = z.object({
  column: z.string().min(1),
  op: z.enum(['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT IN', 'LIKE', 'BETWEEN']),
  value: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
});

export const createMetricSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  expression: z.string().min(1),
  metricType: z.enum(['atomic', 'derived', 'composite']),
  sourceTableId: z.string().uuid().optional(),
  filters: z.array(metricFilterSchema).optional(),
  dimensions: z.array(z.string()).optional(),
  granularity: z.array(z.string()).optional(),
  derivedFrom: z.array(z.string().uuid()).optional(),
  format: z.enum(['number', 'percentage', 'currency']).default('number'),
});

export const updateMetricSchema = createMetricSchema
  .omit({ projectId: true, metricType: true })
  .partial();
