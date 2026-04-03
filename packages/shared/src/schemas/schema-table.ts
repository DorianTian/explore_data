import { z } from 'zod';

/** Schema ingest — user feeds DDL, platform parses everything */
export const ingestDdlSchema = z.object({
  datasourceId: z.string().uuid(),
  ddl: z.string().min(1),
});

/** Lightweight annotation — user enriches after ingest */
export const annotateTableSchema = z.object({
  comment: z.string().max(500).optional(),
});

export const annotateColumnSchema = z.object({
  comment: z.string().max(500).optional(),
  sampleValues: z.array(z.string()).max(10).optional(),
  isPii: z.boolean().optional(),
});
