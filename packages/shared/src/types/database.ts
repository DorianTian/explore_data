import type { z } from 'zod';
import type { connectionConfigSchema } from '../schemas/datasource.js';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Datasource {
  id: string;
  projectId: string;
  name: string;
  dialect: string;
  engineType: string;
  connectionConfig: z.infer<typeof connectionConfigSchema> | null;
  createdAt: Date;
}

export interface SchemaTable {
  id: string;
  datasourceId: string;
  name: string;
  comment: string | null;
  rowCount: number | null;
  ddl: string | null;
  layer: string | null;
  domain: string | null;
  createdAt: Date;
}

export interface SchemaColumn {
  id: string;
  tableId: string;
  name: string;
  dataType: string;
  comment: string | null;
  sampleValues: string[] | null;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isPii: boolean;
  ordinalPosition: number;
}

export interface SchemaRelationship {
  id: string;
  datasourceId: string;
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
  relationshipType: 'fk' | 'implicit';
}
