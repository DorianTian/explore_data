import { z } from 'zod';

export const createKnowledgeDocSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  docType: z.enum(['glossary', 'template', 'document']),
});

export const createGlossaryEntrySchema = z.object({
  projectId: z.string().uuid(),
  term: z.string().min(1).max(100),
  sqlExpression: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const updateGlossaryEntrySchema = z.object({
  term: z.string().min(1).max(100).optional(),
  sqlExpression: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
});
