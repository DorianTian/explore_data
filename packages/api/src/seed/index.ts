/**
 * Seed orchestrator — imports all 7 domain definitions (~1000 tables),
 * generates DDL, and seeds the database via service layer.
 *
 * Usage: tsx packages/api/src/seed/index.ts
 */
import pino from 'pino';
import { createDbClient } from '@nl2sql/db';
import { ProjectService } from '../services/project-service.js';
import { DatasourceService } from '../services/datasource-service.js';
import { SchemaService } from '../services/schema-service.js';
import { MetricService } from '../services/metric-service.js';
import { KnowledgeService } from '../services/knowledge-service.js';
import { ConversationService } from '../services/conversation-service.js';
import { generateDomainDdl } from './generator.js';
import type { DomainDefinition } from './domains/types.js';

import { ecommerceDomain } from './domains/ecommerce.js';
import { financeDomain } from './domains/finance.js';
import { userGrowthDomain } from './domains/user-growth.js';
import { supplyChainDomain } from './domains/supply-chain.js';
import { marketingDomain } from './domains/marketing.js';
import { crmContentDomain } from './domains/crm-content.js';
import { dataGovernanceDomain } from './domains/data-governance.js';

const logger = pino({ level: 'info' });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  logger.error('DATABASE_URL is required');
  process.exit(1);
}

const ALL_DOMAINS: DomainDefinition[] = [
  ecommerceDomain,
  financeDomain,
  userGrowthDomain,
  supplyChainDomain,
  marketingDomain,
  crmContentDomain,
  dataGovernanceDomain,
];

/** Find table ID from ingest result by table name */
function findTableId(
  tables: Array<{ table: { id: string; name: string } }>,
  name: string,
  domainName: string,
): string {
  const t = tables.find((r) => r.table.name === name);
  if (!t) {
    logger.warn({ table: name, domain: domainName }, 'Table not found, skipping metric');
    return '';
  }
  return t.table.id;
}

async function seedDomain(
  domain: DomainDefinition,
  projectId: string,
  services: {
    ds: DatasourceService;
    schema: SchemaService;
    metric: MetricService;
    knowledge: KnowledgeService;
    conversation: ConversationService;
  },
) {
  const { ds, schema, metric, knowledge, conversation } = services;

  /* Datasource + DDL */
  const datasource = await ds.create({
    projectId,
    name: domain.name,
    dialect: domain.dialect as 'postgresql' | 'mysql',
  });

  const ddl = generateDomainDdl(domain.tables);
  const ingest = await schema.ingestDdl(datasource.id, ddl);
  logger.info(
    { domain: domain.name, tables: ingest.tables.length, rels: ingest.relationships.length },
    'Schema ingested',
  );

  /* Metrics */
  let metricCount = 0;
  for (const m of domain.metrics) {
    const tableId = findTableId(ingest.tables, m.sourceTable, domain.name);
    if (!tableId) continue;
    await metric.create({
      projectId,
      name: m.name,
      displayName: m.displayName,
      description: m.description,
      expression: m.expression,
      metricType: m.metricType,
      sourceTableId: tableId,
      filters: m.filters as Parameters<typeof metric.create>[0]['filters'],
      dimensions: m.dimensions,
      granularity: m.granularity,
      format: m.format ?? 'number',
    });
    metricCount++;
  }

  /* Glossary */
  for (const g of domain.glossary) {
    await knowledge.createGlossaryEntry({ projectId, ...g });
  }

  /* Knowledge docs */
  for (const d of domain.knowledgeDocs) {
    await knowledge.createDoc({ projectId, ...d });
  }

  /* Conversations */
  for (const conv of domain.conversations) {
    const row = await conversation.createConversation(projectId, conv.title);
    for (const msg of conv.messages) {
      await conversation.addMessage({
        conversationId: row.id,
        role: msg.role,
        content: msg.content,
        generatedSql: msg.sql,
        confidence: msg.confidence,
      });
    }
  }

  /* Query history */
  for (const q of domain.queryHistory) {
    await conversation.recordQuery(projectId, {
      naturalLanguage: q.naturalLanguage,
      generatedSql: q.generatedSql,
      status: q.status,
      isGolden: q.isGolden,
      tablesUsed: q.tablesUsed,
    });
  }

  logger.info(
    {
      domain: domain.name,
      metrics: metricCount,
      glossary: domain.glossary.length,
      docs: domain.knowledgeDocs.length,
      conversations: domain.conversations.length,
      queries: domain.queryHistory.length,
    },
    'Domain seed complete',
  );
}

async function seed() {
  const db = createDbClient(DATABASE_URL!);
  const projSvc = new ProjectService(db);
  const services = {
    ds: new DatasourceService(db),
    schema: new SchemaService(db),
    metric: new MetricService(db),
    knowledge: new KnowledgeService(db),
    conversation: new ConversationService(db),
  };

  logger.info('=== NL2SQL Enterprise Seed ===');

  const project = await projSvc.create({
    name: 'NL2SQL Enterprise Demo',
    description:
      '企业级数据平台示例，覆盖电商、金融、用户增长、供应链、营销、客服、数据治理 7 大业务域',
  });
  logger.info({ projectId: project.id }, 'Project created');

  let totalTables = 0;
  let totalMetrics = 0;
  let totalGlossary = 0;

  for (const domain of ALL_DOMAINS) {
    await seedDomain(domain, project.id, services);
    totalTables += domain.tables.length;
    totalMetrics += domain.metrics.length;
    totalGlossary += domain.glossary.length;
  }

  logger.info(
    {
      projectId: project.id,
      domains: ALL_DOMAINS.length,
      tables: totalTables,
      metrics: totalMetrics,
      glossary: totalGlossary,
    },
    '=== Seed Complete ===',
  );

  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
