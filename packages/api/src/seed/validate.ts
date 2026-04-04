/**
 * Validates all domain definitions without touching the database.
 * Checks: table counts, layer distribution, FK references, unique names,
 * metric source tables, glossary/doc/conversation/query counts.
 *
 * Usage: tsx packages/api/src/seed/validate.ts
 */
import { ecommerceDomain } from './domains/ecommerce.js';
import { financeDomain } from './domains/finance.js';
import { userGrowthDomain } from './domains/user-growth.js';
import { supplyChainDomain } from './domains/supply-chain.js';
import { marketingDomain } from './domains/marketing.js';
import { crmContentDomain } from './domains/crm-content.js';
import { dataGovernanceDomain } from './domains/data-governance.js';
import { generateDdl } from './generator.js';
import type { DomainDefinition } from './domains/types.js';

const ALL_DOMAINS: DomainDefinition[] = [
  ecommerceDomain,
  financeDomain,
  userGrowthDomain,
  supplyChainDomain,
  marketingDomain,
  crmContentDomain,
  dataGovernanceDomain,
];

interface ValidationResult {
  domain: string;
  tables: number;
  layers: Record<string, number>;
  metrics: number;
  glossary: number;
  docs: number;
  conversations: number;
  queries: number;
  errors: string[];
  warnings: string[];
}

function validateDomain(domain: DomainDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const layers: Record<string, number> = { ods: 0, dwd: 0, dws: 0, ads: 0 };
  const tableNames = new Set<string>();

  for (const table of domain.tables) {
    /* Unique name check */
    if (tableNames.has(table.name)) {
      errors.push(`Duplicate table: ${table.name}`);
    }
    tableNames.add(table.name);

    /* Layer count */
    layers[table.layer] = (layers[table.layer] ?? 0) + 1;

    /* Column checks */
    if (table.columns.length === 0) {
      errors.push(`Empty columns: ${table.name}`);
    }

    const colNames = new Set<string>();
    for (const col of table.columns) {
      if (colNames.has(col.name)) {
        errors.push(`Duplicate column ${col.name} in ${table.name}`);
      }
      colNames.add(col.name);

      if (!col.comment) {
        warnings.push(`Missing comment: ${table.name}.${col.name}`);
      }
    }

    /* FK reference check — target table should exist in domain */
    for (const col of table.columns) {
      if (col.referencesTable && !tableNames.has(col.referencesTable)) {
        /* Might reference a table defined later, re-check at end */
      }
    }

    /* DDL generation check */
    try {
      generateDdl(table);
    } catch (e) {
      errors.push(`DDL generation failed for ${table.name}: ${e}`);
    }
  }

  /* FK final pass */
  for (const table of domain.tables) {
    for (const col of table.columns) {
      if (col.referencesTable && !tableNames.has(col.referencesTable)) {
        warnings.push(
          `FK target not in domain: ${table.name}.${col.name} -> ${col.referencesTable}`,
        );
      }
    }
  }

  /* Metric source table check */
  for (const m of domain.metrics) {
    if (!tableNames.has(m.sourceTable)) {
      warnings.push(`Metric "${m.name}" references unknown table: ${m.sourceTable}`);
    }
  }

  return {
    domain: domain.name,
    tables: domain.tables.length,
    layers,
    metrics: domain.metrics.length,
    glossary: domain.glossary.length,
    docs: domain.knowledgeDocs.length,
    conversations: domain.conversations.length,
    queries: domain.queryHistory.length,
    errors,
    warnings,
  };
}

/* Run */
let totalTables = 0;
let totalErrors = 0;
let totalWarnings = 0;

console.log('\n=== NL2SQL Seed Validation ===\n');

for (const domain of ALL_DOMAINS) {
  const result = validateDomain(domain);
  totalTables += result.tables;
  totalErrors += result.errors.length;
  totalWarnings += result.warnings.length;

  const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${result.domain}: ${result.tables} tables ` +
      `(ODS:${result.layers.ods} DWD:${result.layers.dwd} DWS:${result.layers.dws} ADS:${result.layers.ads}) ` +
      `| ${result.metrics} metrics | ${result.glossary} glossary | ${result.docs} docs ` +
      `| ${result.conversations} convs | ${result.queries} queries`,
  );

  if (result.errors.length > 0) {
    for (const e of result.errors) console.log(`  ERROR: ${e}`);
  }
  if (result.warnings.length > 0 && result.warnings.length <= 10) {
    for (const w of result.warnings) console.log(`  WARN: ${w}`);
  } else if (result.warnings.length > 10) {
    console.log(`  WARN: ${result.warnings.length} warnings (showing first 5)`);
    for (const w of result.warnings.slice(0, 5)) console.log(`  WARN: ${w}`);
  }
}

console.log(
  `\n=== Total: ${totalTables} tables | ${totalErrors} errors | ${totalWarnings} warnings ===\n`,
);

if (totalErrors > 0) {
  process.exit(1);
}
