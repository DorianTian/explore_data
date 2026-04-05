# Seed Expand: Production-Only Table Expansion (290 → 2000)

## Goal

Expand the production database from 290 to 2000 physical tables with realistic sample data, without modifying local seed files.

## Approach

A standalone `packages/api/src/seed/seed-expand.ts` script that:

1. Connects to production DB via `DATABASE_URL`
2. Reads existing 5 datasource records (with their IDs and pgSchema names)
3. Programmatically generates ~1710 additional table definitions
4. Inserts metadata (`schema_tables` + `schema_columns`)
5. Creates physical PostgreSQL tables via DDL
6. Inserts 100 sample rows per table with realistic Chinese business data
7. Idempotent: skips tables that already exist by name+datasourceId

## Table Distribution

Each engine grows from current count to ~400 tables:

| Engine   | Current | Target | Add  | Primary Layers      |
|----------|---------|--------|------|---------------------|
| MySQL    | 55      | 400    | 345  | ODS, DIM, DWD, DWS  |
| Hive     | 70      | 400    | 330  | DWD, DWS, DIM, ADS  |
| Doris    | 60      | 400    | 340  | ADS, DWS, DWD, DIM  |
| Iceberg  | 55      | 400    | 345  | DWD, DWS, DIM, ADS  |
| Spark    | 50      | 400    | 350  | DWS, ADS, DWD, DIM  |

## Table Generation Strategy

### Naming Convention

```
ods_{domain}_{area}_{suffix}           (suffix: _df, _di, _log, _snap)
dwd_{domain}_{area}_detail_{suffix}    (suffix: _di, _df)
dws_{domain}_{area}_{metric}_{period}  (period: _1d, _7d, _30d)
dim_{entity}
ads_{domain}_{report}_{period}         (period: _1d, _7d, _30d)
```

### Domain × Business Area Matrix

Each domain has 15-20 business areas. Crossing with layers produces the table count:

**trade** (~20 areas): order, payment, refund, logistics, settlement, invoice, contract, commission, subscription, coupon_usage, flash_sale, group_buy, pre_sale, cross_border, after_sale, dispute, evaluation, cart, checkout, delivery_fee

**user** (~20 areas): register, profile, login, session, behavior, preference, feedback, notification, membership, address, device, credit, identity, social, invite, growth_task, signin, points, wallet, blacklist

**product** (~20 areas): catalog, sku, inventory, pricing, promotion, review, recommendation, collection, tag, attribute, warehouse, supplier, quality, lifecycle, bundle, comparison, seo, media, variant, stock_alert

**risk** (~15 areas): fraud_detect, audit_log, compliance, monitor, alert, rule_engine, blocklist, verification, credit_score, anti_spam, device_fingerprint, ip_risk, transaction_risk, account_security, data_quality

### Column Templates by Layer

- **ODS** (8-15 cols): pk, business fields, raw status, source_system, created_at, updated_at, ds
- **DWD** (10-18 cols): pk, cleaned fields, FK refs, derived fields, etl_time, ds
- **DWS** (8-14 cols): pk/composite key, dimension fields, SUM/COUNT/AVG metrics, stat_date
- **DIM** (6-12 cols): pk, code, name, attributes, status, valid_from, valid_to
- **ADS** (8-16 cols): pk, dimension fields, KPI metrics, period, snapshot_date

### Layer Distribution per Engine

Each engine emphasizes different layers based on its real-world role:

- **MySQL** (OLTP): ODS 40%, DIM 25%, DWD 20%, DWS 15%
- **Hive** (offline DW): DWD 30%, DWS 30%, DIM 15%, ADS 25%
- **Doris** (OLAP): ADS 35%, DWS 30%, DWD 20%, DIM 15%
- **Iceberg** (lakehouse): DWD 35%, DWS 25%, DIM 20%, ADS 20%
- **Spark** (compute): DWS 30%, ADS 30%, DWD 25%, DIM 15%

## Sample Data Strategy

Enrich existing `generateValue` value pools with public data:

- **Geography**: Full China administrative divisions (省/市/区, 340+ cities)
- **Products**: Expanded realistic product names, brands, categories (100+ per pool)
- **Commerce**: More payment methods, logistics companies, coupon types
- **Users**: Realistic name pools, age distributions, membership tiers
- **Finance**: Industry codes, company types, settlement terms

Reuse the existing `physical-tables.ts` logic: `toPgType()`, `generateValue()`, `generateRows()`. Import and extend rather than duplicate.

## Script Structure

```
seed-expand.ts
├── Define expanded value pools (geography, products, etc.)
├── Define business area registry (domain → areas[])
├── Define column templates (layer → column patterns[])
├── generateTableDefs(engine, targetCount, existingNames) → TableDef[]
│   ├── For each domain × area × layer combination
│   ├── Apply engine layer distribution weights
│   └── Generate columns from templates + domain-specific fields
├── main()
│   ├── Connect to DB
│   ├── Read datasources + existing table names
│   ├── For each engine:
│   │   ├── Generate missing table defs
│   │   ├── Insert schema_tables + schema_columns
│   │   ├── CREATE TABLE in pgSchema
│   │   └── INSERT sample data (100 rows)
│   └── Print summary
```

## Execution

```bash
ssh ubuntu@13.214.45.162
cd /opt/aix-ops-hub/nl2sql
DATABASE_URL=<prod_url> npx tsx packages/api/src/seed/seed-expand.ts
```

## Non-Goals

- Does NOT modify existing seed files or tables
- Does NOT touch metrics, glossary, or other metadata
- Does NOT generate embeddings (separate step if needed)
- Local dev stays at 290 tables
