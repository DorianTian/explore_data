# Phase 3: Seed Data (1000 Tables) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a comprehensive enterprise-grade seed dataset with ~1000 tables across 7 business domains, each with metrics, glossary, knowledge docs, and sample conversations. Users can experience all product features without uploading their own data.

**Architecture:** Seed generator engine reads structured domain definitions (TypeScript objects) and produces DDL strings, metric definitions, glossary entries, knowledge documents, and sample conversations. Each domain is a separate datasource with ODS → DWD → DWS → ADS layering.

**Tech Stack:** TypeScript seed generator, Drizzle ORM, existing SchemaService/MetricService/KnowledgeService/ConversationService

**Prerequisite:** Phase 1 & 2 complete (tri-state feedback, query history endpoint)

---

## Task 1: Domain Definition Types

**Files:**
- Create: `packages/api/src/seed/domains/types.ts`

- [ ] **Step 1: Define the domain definition schema**

```typescript
// packages/api/src/seed/domains/types.ts

export interface ColumnDef {
  name: string;
  dataType: string;
  comment: string;
  isPrimaryKey?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  isPii?: boolean;
  sampleValues?: string[];
  referencesTable?: string;
  referencesColumn?: string;
}

export interface TableDef {
  name: string;
  comment: string;
  layer: 'ods' | 'dwd' | 'dws' | 'ads';
  columns: ColumnDef[];
}

export interface MetricDef {
  name: string;
  displayName: string;
  expression: string;
  metricType: 'atomic' | 'derived' | 'composite';
  sourceTable: string;
  filters?: Array<{ column: string; op: string; value: string }>;
  dimensions?: string[];
  granularity?: string[];
  format?: 'number' | 'percentage' | 'currency';
  description?: string;
}

export interface GlossaryDef {
  term: string;
  sqlExpression: string;
  description: string;
}

export interface KnowledgeDocDef {
  title: string;
  content: string;
  docType: 'glossary' | 'template' | 'document';
}

export interface ConversationDef {
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    confidence?: number;
  }>;
}

export interface QueryHistoryDef {
  naturalLanguage: string;
  generatedSql: string;
  status: 'accepted' | 'pending' | 'rejected';
  isGolden: boolean;
  tablesUsed?: string[];
}

export interface DomainDefinition {
  name: string;
  description: string;
  dialect: string;
  tables: TableDef[];
  metrics: MetricDef[];
  glossary: GlossaryDef[];
  knowledgeDocs: KnowledgeDocDef[];
  conversations: ConversationDef[];
  queryHistory: QueryHistoryDef[];
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/domains/types.ts
git commit -m "feat(seed): define domain definition types for seed generator"
```

---

## Task 2: DDL Generator Engine

**Files:**
- Create: `packages/api/src/seed/generator.ts`

- [ ] **Step 1: Build the DDL generator from domain definitions**

```typescript
// packages/api/src/seed/generator.ts

import type { TableDef, ColumnDef } from './domains/types.js';

/**
 * Generate a MySQL-style DDL string from a table definition.
 * Uses COMMENT syntax for column and table annotations.
 */
export function generateDdl(table: TableDef): string {
  const columns = table.columns.map((col) => {
    const parts: string[] = [`  ${col.name} ${col.dataType}`];

    if (col.isPrimaryKey) parts.push('PRIMARY KEY');
    if (col.isNullable === false && !col.isPrimaryKey) parts.push('NOT NULL');
    if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);

    // Inline FK reference
    if (col.referencesTable && col.referencesColumn) {
      parts.push(`REFERENCES ${col.referencesTable}(${col.referencesColumn})`);
    }

    parts.push(`COMMENT '${escapeComment(col.comment)}'`);

    return parts.join(' ');
  });

  return `CREATE TABLE ${table.name} (\n${columns.join(',\n')}\n) COMMENT='${escapeComment(table.comment)}';`;
}

/**
 * Generate DDLs for an entire domain (all tables).
 */
export function generateDomainDdl(tables: TableDef[]): string {
  return tables.map(generateDdl).join('\n\n');
}

function escapeComment(text: string): string {
  return text.replace(/'/g, "''");
}

/**
 * Helper to create common column patterns.
 */
export const col = {
  id: (comment = 'ID'): ColumnDef => ({
    name: 'id',
    dataType: 'BIGINT',
    comment,
    isPrimaryKey: true,
  }),

  uuid: (comment = 'UUID'): ColumnDef => ({
    name: 'id',
    dataType: 'VARCHAR(36)',
    comment,
    isPrimaryKey: true,
  }),

  fk: (name: string, refTable: string, comment: string, refColumn = 'id'): ColumnDef => ({
    name,
    dataType: 'BIGINT',
    comment,
    isNullable: false,
    referencesTable: refTable,
    referencesColumn: refColumn,
  }),

  varchar: (name: string, len: number, comment: string, opts: Partial<ColumnDef> = {}): ColumnDef => ({
    name,
    dataType: `VARCHAR(${len})`,
    comment,
    ...opts,
  }),

  text: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'TEXT',
    comment,
  }),

  int: (name: string, comment: string, opts: Partial<ColumnDef> = {}): ColumnDef => ({
    name,
    dataType: 'INT',
    comment,
    ...opts,
  }),

  bigint: (name: string, comment: string, opts: Partial<ColumnDef> = {}): ColumnDef => ({
    name,
    dataType: 'BIGINT',
    comment,
    ...opts,
  }),

  decimal: (name: string, precision: string, comment: string): ColumnDef => ({
    name,
    dataType: `DECIMAL(${precision})`,
    comment,
  }),

  bool: (name: string, comment: string, defaultVal = 'false'): ColumnDef => ({
    name,
    dataType: 'BOOLEAN',
    comment,
    defaultValue: defaultVal,
  }),

  date: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'DATE',
    comment,
  }),

  timestamp: (name: string, comment: string, defaultVal?: string): ColumnDef => ({
    name,
    dataType: 'TIMESTAMP',
    comment,
    defaultValue: defaultVal,
  }),

  json: (name: string, comment: string): ColumnDef => ({
    name,
    dataType: 'JSONB',
    comment,
  }),

  status: (comment: string, values: string): ColumnDef => ({
    name: 'status',
    dataType: 'VARCHAR(30)',
    comment: `${comment}: ${values}`,
  }),

  createdAt: (): ColumnDef => ({
    name: 'created_at',
    dataType: 'TIMESTAMP',
    comment: '创建时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),

  updatedAt: (): ColumnDef => ({
    name: 'updated_at',
    dataType: 'TIMESTAMP',
    comment: '更新时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),

  etlTime: (): ColumnDef => ({
    name: 'etl_time',
    dataType: 'TIMESTAMP',
    comment: 'ETL 处理时间',
    defaultValue: 'CURRENT_TIMESTAMP',
  }),

  ds: (): ColumnDef => ({
    name: 'ds',
    dataType: 'DATE',
    comment: '数据分区日期',
    isNullable: false,
  }),
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/generator.ts
git commit -m "feat(seed): add DDL generator engine with column helper builders"
```

---

## Task 3–9: Domain Definitions

Each domain follows the same pattern. I'll provide the complete E-commerce domain as the reference implementation, then specify table counts and key tables for the remaining 6 domains. Each domain should be implemented following the same pattern.

### Task 3: E-commerce Domain (~200 tables)

**Files:**
- Create: `packages/api/src/seed/domains/ecommerce.ts`

- [ ] **Step 1: Define E-commerce domain with all 4 layers**

The E-commerce domain needs ~200 tables across ODS/DWD/DWS/ADS. Structure:

**ODS Layer (~60 tables)** — Raw source tables:
- Core: ods_users, ods_user_addresses, ods_user_login_log, ods_user_devices, ods_user_profiles
- Product: ods_products, ods_product_categories, ods_product_brands, ods_product_skus, ods_product_attributes, ods_product_images, ods_product_reviews, ods_product_price_history
- Order: ods_orders, ods_order_items, ods_order_payments, ods_order_refunds, ods_order_logistics, ods_order_coupons, ods_order_invoices
- Promotion: ods_coupons, ods_coupon_rules, ods_promotions, ods_promotion_products, ods_flash_sales, ods_flash_sale_products
- Inventory: ods_warehouses, ods_warehouse_inventory, ods_inventory_movements, ods_purchase_orders, ods_purchase_order_items
- Payment: ods_payment_channels, ods_payment_transactions, ods_payment_settlements
- Membership: ods_membership_levels, ods_membership_points, ods_membership_point_records
- Content: ods_banners, ods_articles, ods_notifications, ods_notification_reads
- User Behavior: ods_page_views, ods_click_events, ods_search_logs, ods_cart_items, ods_favorites, ods_shares
- Store: ods_stores, ods_store_categories, ods_store_staff, ods_store_settings
- After-sales: ods_return_requests, ods_return_items, ods_complaints, ods_service_tickets
- Third-party: ods_sms_logs, ods_email_logs, ods_push_logs

**DWD Layer (~50 tables)** — Cleaned fact + dimension tables (star schema):
- dim_users, dim_products, dim_product_categories, dim_brands, dim_stores, dim_warehouses, dim_regions, dim_payment_channels, dim_coupons, dim_membership_levels, dim_devices, dim_date
- fact_orders, fact_order_items, fact_payments, fact_refunds, fact_page_views, fact_clicks, fact_searches, fact_cart_operations, fact_favorites, fact_reviews, fact_inventory_movements, fact_point_transactions, fact_coupon_usage, fact_logistics, fact_user_logins, fact_notifications, fact_sms, fact_store_operations
- bridge_order_coupon, bridge_product_category, bridge_user_address

**DWS Layer (~50 tables)** — Pre-aggregated:
- dws_user_daily_stats, dws_user_monthly_stats, dws_user_lifetime_value, dws_user_cohort
- dws_product_daily_sales, dws_product_category_stats, dws_brand_monthly_stats
- dws_order_daily_summary, dws_order_hourly_summary, dws_order_channel_stats
- dws_revenue_daily, dws_revenue_weekly, dws_revenue_monthly, dws_revenue_region
- dws_payment_daily_stats, dws_refund_daily_stats
- dws_inventory_daily_snapshot, dws_warehouse_utilization
- dws_coupon_effectiveness, dws_promotion_roi
- dws_page_daily_stats, dws_funnel_daily, dws_search_keyword_stats
- dws_membership_level_dist, dws_points_daily_stats
- dws_store_daily_performance, dws_store_ranking
- dws_logistics_daily_stats, dws_delivery_sla
- dws_review_sentiment_daily, dws_complaint_daily
- dws_cart_abandonment_daily, dws_wishlist_stats
- dws_notification_effectiveness, dws_channel_attribution

**ADS Layer (~40 tables)** — Application-facing:
- ads_realtime_dashboard, ads_gmv_board, ads_order_monitor
- ads_user_portrait, ads_user_segmentation, ads_user_rfm, ads_user_churn_prediction
- ads_product_recommendation, ads_product_ranking, ads_product_affinity
- ads_marketing_roi, ads_campaign_performance, ads_channel_attribution_model
- ads_inventory_alert, ads_restock_suggestion
- ads_store_leaderboard, ads_store_health_score
- ads_customer_journey, ads_funnel_conversion
- ads_search_optimization, ads_search_ranking
- ads_coupon_optimization, ads_price_elasticity
- ads_logistics_performance, ads_delivery_prediction
- ads_review_analysis, ads_complaint_root_cause
- ads_revenue_forecast, ads_seasonal_trend
- ads_ab_test_results, ads_feature_flag_impact
- ads_report_daily_executive, ads_report_weekly_ops, ads_report_monthly_finance

```typescript
// packages/api/src/seed/domains/ecommerce.ts
// This file will be very large. Key structure:

import type { DomainDefinition } from './types.js';
import { col } from '../generator.js';

export const ecommerceDomain: DomainDefinition = {
  name: '电商交易分析',
  description: '电商平台全链路数据，覆盖用户、商品、订单、支付、物流、营销、库存、会员、评价等业务域，支持 GMV 分析、用户画像、商品运营、营销效果评估等场景',
  dialect: 'postgresql',
  tables: [
    // === ODS Layer ===
    {
      name: 'ods_users',
      comment: '用户基础信息（贴源层）',
      layer: 'ods',
      columns: [
        col.id('用户ID'),
        col.varchar('username', 50, '用户名'),
        col.varchar('email', 200, '邮箱地址', { isPii: true }),
        col.varchar('phone', 20, '手机号', { isPii: true }),
        col.varchar('gender', 10, '性别: male/female/unknown', { sampleValues: ['male', 'female', 'unknown'] }),
        col.varchar('city', 50, '所在城市', { sampleValues: ['北京', '上海', '深圳', '广州', '杭州'] }),
        col.varchar('province', 50, '所在省份'),
        col.date('birth_date', '出生日期'),
        col.date('register_date', '注册日期'),
        col.varchar('register_channel', 30, '注册渠道: app/web/mini_program/h5', { sampleValues: ['app', 'web', 'mini_program', 'h5'] }),
        col.timestamp('last_login', '最后登录时间'),
        col.status('用户状态', 'active/inactive/banned'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    // ... remaining ~199 tables follow the same pattern
    // Each table has full column definitions with comments and sample values
    // FK relationships defined via col.fk()
    // Layer tag (ods/dwd/dws/ads) on each table

    // I'll generate the full definitions programmatically below
  ],

  metrics: [
    {
      name: 'gmv',
      displayName: 'GMV（成交总额）',
      expression: 'SUM(payment_amount)',
      metricType: 'atomic',
      sourceTable: 'fact_orders',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
      dimensions: ['region', 'channel', 'order_date', 'store_id'],
      granularity: ['day', 'week', 'month', 'quarter'],
      format: 'currency',
      description: '所有已完成订单的实付金额总和',
    },
    {
      name: 'order_count',
      displayName: '订单量',
      expression: 'COUNT(DISTINCT order_id)',
      metricType: 'atomic',
      sourceTable: 'fact_orders',
      dimensions: ['region', 'channel', 'status', 'order_date'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
    },
    {
      name: 'avg_order_value',
      displayName: '客单价（AOV）',
      expression: 'AVG(payment_amount)',
      metricType: 'atomic',
      sourceTable: 'fact_orders',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
      dimensions: ['channel', 'region'],
      format: 'currency',
    },
    {
      name: 'paying_user_count',
      displayName: '付费用户数',
      expression: 'COUNT(DISTINCT user_id)',
      metricType: 'atomic',
      sourceTable: 'fact_orders',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
      format: 'number',
    },
    {
      name: 'arpu',
      displayName: 'ARPU（每用户平均收入）',
      expression: 'SUM(payment_amount) / COUNT(DISTINCT user_id)',
      metricType: 'derived',
      sourceTable: 'fact_orders',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
      format: 'currency',
    },
    {
      name: 'refund_rate',
      displayName: '退款率',
      expression: 'COUNT(DISTINCT CASE WHEN status = \'refunded\' THEN order_id END) * 100.0 / COUNT(DISTINCT order_id)',
      metricType: 'derived',
      sourceTable: 'fact_orders',
      format: 'percentage',
    },
    {
      name: 'cart_conversion_rate',
      displayName: '加购转化率',
      expression: 'COUNT(DISTINCT CASE WHEN has_order = true THEN user_id END) * 100.0 / COUNT(DISTINCT user_id)',
      metricType: 'derived',
      sourceTable: 'dws_funnel_daily',
      format: 'percentage',
    },
    {
      name: 'dau',
      displayName: '日活跃用户数',
      expression: 'COUNT(DISTINCT user_id)',
      metricType: 'atomic',
      sourceTable: 'dws_user_daily_stats',
      dimensions: ['platform', 'ds'],
      granularity: ['day'],
      format: 'number',
    },
    {
      name: 'retention_d7',
      displayName: '7日留存率',
      expression: 'retained_users_d7 * 100.0 / cohort_size',
      metricType: 'derived',
      sourceTable: 'dws_user_cohort',
      format: 'percentage',
    },
    {
      name: 'inventory_turnover',
      displayName: '库存周转率',
      expression: 'total_sold_quantity * 1.0 / avg_inventory_quantity',
      metricType: 'derived',
      sourceTable: 'dws_inventory_daily_snapshot',
      format: 'number',
    },
  ],

  glossary: [
    { term: '活跃用户', sqlExpression: "WHERE last_login > NOW() - INTERVAL '30 days'", description: '30天内有登录行为的用户' },
    { term: '新用户', sqlExpression: "WHERE register_date > NOW() - INTERVAL '7 days'", description: '7天内注册的用户' },
    { term: '高价值用户', sqlExpression: "WHERE user_id IN (SELECT user_id FROM fact_orders WHERE status='completed' GROUP BY user_id HAVING SUM(payment_amount) > 10000)", description: '累计消费超过1万元的用户' },
    { term: '复购率', sqlExpression: "COUNT(DISTINCT CASE WHEN order_count > 1 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id)", description: '有2次及以上购买的用户占比' },
    { term: '客单价', sqlExpression: 'AVG(payment_amount)', description: '每笔订单的平均实付金额' },
    { term: '退款率', sqlExpression: "COUNT(CASE WHEN status='refunded' THEN 1 END) * 100.0 / COUNT(*)", description: '退款订单占总订单的比例' },
    { term: '连带率', sqlExpression: 'AVG(item_count)', description: '每笔订单的平均商品件数' },
    { term: '动销率', sqlExpression: "COUNT(DISTINCT CASE WHEN sold_quantity > 0 THEN product_id END) * 100.0 / COUNT(DISTINCT product_id)", description: '有销量的商品占总商品数的比例' },
    { term: 'GMV', sqlExpression: "SUM(total_amount) WHERE status='completed'", description: '成交总额，已完成订单的订单金额总和' },
    { term: '毛利率', sqlExpression: '(SUM(payment_amount) - SUM(cost_amount)) * 100.0 / SUM(payment_amount)', description: '(收入-成本)/收入 的百分比' },
  ],

  knowledgeDocs: [
    {
      title: '电商业务指标口径说明',
      docType: 'document',
      content: `# 电商核心指标口径

## GMV（成交总额）
- 定义：所有状态为 completed 的订单的 payment_amount 之和
- 注意：不含已取消和已退款订单
- 表：fact_orders
- 字段：payment_amount, status

## 订单转化漏斗
- 浏览 → 加购 → 下单 → 支付 → 完成
- 各环节转化率 = 下一环节人数 / 当前环节人数 × 100%
- 表：dws_funnel_daily

## 用户分层规则
- RFM 模型：R(最近购买时间) F(购买频次) M(消费金额)
- 高价值用户：R<30天, F>5次, M>10000元
- 流失用户：R>90天
- 表：ads_user_rfm

## 库存相关
- 安全库存 = 日均销量 × 补货周期 × 安全系数(1.5)
- 周转天数 = 平均库存 / 日均销量
- 表：dws_inventory_daily_snapshot`,
    },
    {
      title: '数据分层规范',
      docType: 'document',
      content: `# 数仓分层规范

## ODS（贴源层）
- 原始数据，不做清洗，保留全字段
- 表名前缀：ods_
- 按天分区（ds字段）

## DWD（明细层）
- 清洗、标准化、关联维度
- 事实表前缀：fact_，维度表前缀：dim_
- 保留明细粒度

## DWS（汇总层）
- 按主题域预聚合
- 表名前缀：dws_
- 常见粒度：用户+日、商品+日、订单+日

## ADS（应用层）
- 面向具体业务场景
- 表名前缀：ads_
- 直接服务于报表、Dashboard、API`,
    },
  ],

  conversations: [
    {
      title: '电商 GMV 分析',
      messages: [
        { role: 'user', content: '上个月各区域的 GMV 是多少？' },
        { role: 'assistant', content: '根据已完成订单数据，上个月各区域 GMV 如下（单位：元）。华东区域 GMV 最高，占比约 35%。', sql: "SELECT region, SUM(payment_amount) AS gmv FROM fact_orders WHERE status = 'completed' AND order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY region ORDER BY gmv DESC", confidence: 0.92 },
        { role: 'user', content: '按渠道拆分一下' },
        { role: 'assistant', content: '在区域维度基础上增加渠道维度拆分。App 渠道在各区域均为最大贡献来源。', sql: "SELECT region, channel, SUM(payment_amount) AS gmv FROM fact_orders WHERE status = 'completed' AND order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY region, channel ORDER BY region, gmv DESC", confidence: 0.88 },
      ],
    },
    {
      title: '用户留存分析',
      messages: [
        { role: 'user', content: '最近一个月的新用户 7 日留存率是多少？' },
        { role: 'assistant', content: '查询最近一个月注册的新用户，其 7 日留存率约为 28.5%。', sql: "SELECT cohort_date, retained_users_d7 * 100.0 / cohort_size AS retention_d7 FROM dws_user_cohort WHERE cohort_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY cohort_date", confidence: 0.85 },
      ],
    },
  ],

  queryHistory: [
    { naturalLanguage: '上个月 GMV 多少', generatedSql: "SELECT SUM(payment_amount) AS gmv FROM fact_orders WHERE status = 'completed' AND order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE)", status: 'accepted', isGolden: true, tablesUsed: ['fact_orders'] },
    { naturalLanguage: '日活用户数趋势', generatedSql: "SELECT ds, COUNT(DISTINCT user_id) AS dau FROM dws_user_daily_stats WHERE ds >= CURRENT_DATE - INTERVAL '30 days' GROUP BY ds ORDER BY ds", status: 'accepted', isGolden: true, tablesUsed: ['dws_user_daily_stats'] },
    { naturalLanguage: '销量 Top 10 商品', generatedSql: "SELECT p.name AS product_name, SUM(oi.quantity) AS total_sold FROM fact_order_items oi JOIN dim_products p ON oi.product_id = p.id GROUP BY p.name ORDER BY total_sold DESC LIMIT 10", status: 'accepted', isGolden: false, tablesUsed: ['fact_order_items', 'dim_products'] },
    { naturalLanguage: '各渠道客单价', generatedSql: "SELECT channel, AVG(payment_amount) AS avg_order_value FROM fact_orders WHERE status = 'completed' GROUP BY channel ORDER BY avg_order_value DESC", status: 'accepted', isGolden: true, tablesUsed: ['fact_orders'] },
    { naturalLanguage: '退款率趋势', generatedSql: "SELECT DATE_TRUNC('week', order_date) AS week, COUNT(CASE WHEN status = 'refunded' THEN 1 END) * 100.0 / COUNT(*) AS refund_rate FROM fact_orders GROUP BY week ORDER BY week", status: 'accepted', isGolden: false, tablesUsed: ['fact_orders'] },
  ],
};
```

**IMPORTANT:** The full ecommerce.ts file will contain all ~200 table definitions. The implementing agent should generate all tables following the layering pattern (ODS → DWD → DWS → ADS) with complete column definitions, comments, and FK relationships. Use the `col` helper functions from generator.ts for consistency.

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/domains/ecommerce.ts
git commit -m "feat(seed): add e-commerce domain definition (~200 tables)"
```

---

### Task 4: Finance Domain (~170 tables)

**Files:**
- Create: `packages/api/src/seed/domains/finance.ts`

- [ ] **Step 1: Define Finance & Risk domain**

Key business areas to cover:
- **ODS (~45):** ods_accounts, ods_account_balances, ods_transactions, ods_journal_entries, ods_invoices, ods_invoice_items, ods_budgets, ods_budget_items, ods_cost_centers, ods_expense_reports, ods_expense_items, ods_tax_records, ods_bank_statements, ods_bank_reconciliations, ods_ap_invoices, ods_ar_invoices, ods_payment_terms, ods_currencies, ods_exchange_rates, ods_credit_scores, ods_risk_assessments, ods_risk_events, ods_risk_rules, ods_compliance_records, ods_audit_logs, ods_fraud_alerts, ods_kyc_records, ods_aml_checks, ods_loan_applications, ods_loans, ods_loan_payments, ods_collaterals, ods_guarantors, ods_interest_rates, ods_fee_schedules, ods_fee_transactions, ods_settlements, ods_clearing_records, ods_fund_flows, ods_position_snapshots, ods_margin_calls, ods_regulatory_reports, ods_contract_master, ods_contract_events, ods_revenue_recognition
- **DWD (~40):** dim_accounts, dim_cost_centers, dim_currencies, dim_risk_levels, dim_compliance_types, fact_transactions, fact_journal_entries, fact_invoices, fact_expenses, fact_risk_events, fact_fraud_alerts, fact_loans, fact_loan_payments, etc.
- **DWS (~45):** dws_daily_pnl, dws_monthly_close, dws_budget_vs_actual, dws_cash_flow_daily, dws_ar_aging, dws_ap_aging, dws_risk_score_daily, dws_fraud_daily_stats, dws_loan_portfolio_stats, dws_revenue_recognition_monthly, etc.
- **ADS (~40):** ads_financial_dashboard, ads_risk_heatmap, ads_fraud_detection_board, ads_loan_default_prediction, ads_budget_forecast, ads_cashflow_projection, ads_regulatory_compliance_report, etc.

Follow the same DomainDefinition structure as ecommerce.ts with metrics, glossary, knowledge docs, conversations, and query history.

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/domains/finance.ts
git commit -m "feat(seed): add finance & risk domain definition (~170 tables)"
```

---

### Task 5: User Growth Domain (~130 tables)

**Files:**
- Create: `packages/api/src/seed/domains/user-growth.ts`

Key areas: Registration funnels, retention/cohort analysis, A/B testing, push notifications, user attribution, engagement scoring, lifecycle management, segmentation, channel analytics, referral programs, onboarding flows.

- [ ] **Step 1: Define User Growth domain with full ODS/DWD/DWS/ADS layers**
- [ ] **Step 2: Commit**

---

### Task 6: Supply Chain Domain (~170 tables)

**Files:**
- Create: `packages/api/src/seed/domains/supply-chain.ts`

Key areas: Inventory management, procurement, warehousing, logistics/shipping, quality control, supplier management, demand forecasting, production planning, returns processing, cost optimization.

- [ ] **Step 1: Define Supply Chain domain**
- [ ] **Step 2: Commit**

---

### Task 7: Marketing Domain (~150 tables)

**Files:**
- Create: `packages/api/src/seed/domains/marketing.ts`

Key areas: Campaign management, channel attribution, DMP/audience segments, creative assets, conversion tracking, ROI analysis, A/B testing, content marketing, SEO/SEM, social media analytics, email marketing, push notifications, affiliate programs.

- [ ] **Step 1: Define Marketing domain**
- [ ] **Step 2: Commit**

---

### Task 8: CRM & Content Domain (~100 tables)

**Files:**
- Create: `packages/api/src/seed/domains/crm-content.ts`

Key areas: Customer service tickets, SLA tracking, satisfaction surveys, knowledge base/FAQ, agent performance, escalation management, content CMS, article management, comments/moderation, notification center.

- [ ] **Step 1: Define CRM & Content domain**
- [ ] **Step 2: Commit**

---

### Task 9: Data Governance Domain (~80 tables)

**Files:**
- Create: `packages/api/src/seed/domains/data-governance.ts`

Key areas: Metadata catalog, data quality rules/checks, data lineage (table/column level), access control/permissions, data classification, audit trails, data lifecycle management, compliance rules, data profiling results, schema change history.

- [ ] **Step 1: Define Data Governance domain**
- [ ] **Step 2: Commit**

---

## Task 10: Seed Orchestrator

**Files:**
- Create: `packages/api/src/seed/index.ts`
- Modify: `packages/api/package.json` (update seed script)

- [ ] **Step 1: Create seed orchestrator**

```typescript
// packages/api/src/seed/index.ts

import { createDbClient } from '@nl2sql/db';
import { ProjectService } from '../services/project-service.js';
import { DatasourceService } from '../services/datasource-service.js';
import { SchemaService } from '../services/schema-service.js';
import { MetricService } from '../services/metric-service.js';
import { KnowledgeService } from '../services/knowledge-service.js';
import { ConversationService } from '../services/conversation-service.js';
import { generateDomainDdl } from './generator.js';
import type { DomainDefinition } from './domains/types.js';

// Import all domains
import { ecommerceDomain } from './domains/ecommerce.js';
import { financeDomain } from './domains/finance.js';
import { userGrowthDomain } from './domains/user-growth.js';
import { supplyChainDomain } from './domains/supply-chain.js';
import { marketingDomain } from './domains/marketing.js';
import { crmContentDomain } from './domains/crm-content.js';
import { dataGovernanceDomain } from './domains/data-governance.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';

const ALL_DOMAINS: DomainDefinition[] = [
  ecommerceDomain,
  financeDomain,
  userGrowthDomain,
  supplyChainDomain,
  marketingDomain,
  crmContentDomain,
  dataGovernanceDomain,
];

async function seedDomain(
  domain: DomainDefinition,
  projectId: string,
  services: {
    datasourceService: DatasourceService;
    schemaService: SchemaService;
    metricService: MetricService;
    knowledgeService: KnowledgeService;
    conversationService: ConversationService;
  },
) {
  const { datasourceService, schemaService, metricService, knowledgeService, conversationService } = services;

  console.log(`\n--- Seeding domain: ${domain.name} ---`);

  // 1. Create datasource
  const datasource = await datasourceService.create({
    projectId,
    name: domain.name,
    dialect: domain.dialect,
  });
  console.log(`  Datasource: ${datasource.name} (${datasource.id})`);

  // 2. Ingest DDL (in batches to avoid huge strings)
  const BATCH_SIZE = 50;
  let totalTables = 0;
  let totalRelationships = 0;

  for (let i = 0; i < domain.tables.length; i += BATCH_SIZE) {
    const batch = domain.tables.slice(i, i + BATCH_SIZE);
    const ddl = generateDomainDdl(batch);
    const result = await schemaService.ingestDdl(datasource.id, ddl);
    totalTables += result.tables.length;
    totalRelationships += result.relationships.length;
    console.log(`  DDL batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.tables.length} tables, ${result.relationships.length} relationships`);
  }

  console.log(`  Total: ${totalTables} tables, ${totalRelationships} relationships`);

  // 3. Create metrics
  // Need to look up sourceTableId from ingested tables
  const allTables = await schemaService.listTables(datasource.id);
  const tableNameToId = new Map(allTables.map((t) => [t.name, t.id]));

  for (const m of domain.metrics) {
    const sourceTableId = tableNameToId.get(m.sourceTable);
    await metricService.create({
      projectId,
      name: m.name,
      displayName: m.displayName,
      description: m.description,
      expression: m.expression,
      metricType: m.metricType,
      sourceTableId,
      filters: m.filters,
      dimensions: m.dimensions,
      granularity: m.granularity,
      format: m.format ?? 'number',
    });
  }
  console.log(`  Metrics: ${domain.metrics.length}`);

  // 4. Create glossary entries
  for (const g of domain.glossary) {
    await knowledgeService.createGlossaryEntry({
      projectId,
      term: g.term,
      sqlExpression: g.sqlExpression,
      description: g.description,
    });
  }
  console.log(`  Glossary: ${domain.glossary.length}`);

  // 5. Create knowledge documents
  for (const doc of domain.knowledgeDocs) {
    await knowledgeService.createDoc({
      projectId,
      title: doc.title,
      content: doc.content,
      docType: doc.docType,
    });
  }
  console.log(`  Knowledge docs: ${domain.knowledgeDocs.length}`);

  // 6. Create conversations
  for (const conv of domain.conversations) {
    const conversation = await conversationService.createConversation(projectId, conv.title);
    for (const msg of conv.messages) {
      await conversationService.addMessage({
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
        generatedSql: msg.sql,
        confidence: msg.confidence,
      });
    }
  }
  console.log(`  Conversations: ${domain.conversations.length}`);

  // 7. Create query history
  for (const q of domain.queryHistory) {
    await conversationService.recordQuery(projectId, {
      naturalLanguage: q.naturalLanguage,
      generatedSql: q.generatedSql,
      status: q.status,
      isGolden: q.isGolden,
      tablesUsed: q.tablesUsed,
    });
  }
  console.log(`  Query history: ${domain.queryHistory.length}`);
}

async function seed() {
  const db = createDbClient(DATABASE_URL);
  const projectService = new ProjectService(db);
  const datasourceService = new DatasourceService(db);
  const schemaService = new SchemaService(db);
  const metricService = new MetricService(db);
  const knowledgeService = new KnowledgeService(db);
  const conversationService = new ConversationService(db);

  console.log('=== NL2SQL Enterprise Seed ===\n');

  // Create master project
  const project = await projectService.create({
    name: '企业数据中台',
    description: '企业级数据平台示例，覆盖电商、金融、用户增长、供应链、营销、客服、数据治理 7 大业务域',
  });
  console.log(`Project: ${project.name} (${project.id})`);

  const services = { datasourceService, schemaService, metricService, knowledgeService, conversationService };

  // Seed all domains
  let totalTableCount = 0;
  for (const domain of ALL_DOMAINS) {
    await seedDomain(domain, project.id, services);
    totalTableCount += domain.tables.length;
  }

  console.log(`\n=== Seed Complete ===`);
  console.log(`Total domains: ${ALL_DOMAINS.length}`);
  console.log(`Total tables: ${totalTableCount}`);
  console.log(`\nProject ID: ${project.id}`);
  console.log('Start the servers and open http://localhost:3000');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Update package.json seed script**

In `packages/api/package.json`, update the seed script:

```json
"db:seed": "tsx src/seed/index.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/seed/index.ts packages/api/package.json
git commit -m "feat(seed): add seed orchestrator for all 7 domains"
```

---

## Task 11: Seed Validation

**Files:**
- Create: `packages/api/src/seed/validate.ts`

- [ ] **Step 1: Create validation script that checks all seed SQL is valid**

```typescript
// packages/api/src/seed/validate.ts

import { SqlValidator } from '@nl2sql/engine';
import type { DomainDefinition } from './domains/types.js';
import { ecommerceDomain } from './domains/ecommerce.js';
import { financeDomain } from './domains/finance.js';
import { userGrowthDomain } from './domains/user-growth.js';
import { supplyChainDomain } from './domains/supply-chain.js';
import { marketingDomain } from './domains/marketing.js';
import { crmContentDomain } from './domains/crm-content.js';
import { dataGovernanceDomain } from './domains/data-governance.js';

const ALL_DOMAINS: DomainDefinition[] = [
  ecommerceDomain, financeDomain, userGrowthDomain,
  supplyChainDomain, marketingDomain, crmContentDomain, dataGovernanceDomain,
];

function validate() {
  const validator = new SqlValidator('postgresql');
  let totalErrors = 0;
  let totalQueries = 0;

  for (const domain of ALL_DOMAINS) {
    console.log(`\nValidating ${domain.name}:`);
    console.log(`  Tables: ${domain.tables.length}`);

    // Validate query history SQL
    for (const q of domain.queryHistory) {
      totalQueries++;
      const result = validator.validate(q.generatedSql);
      if (!result.valid) {
        console.error(`  INVALID SQL in query history: "${q.naturalLanguage}"`);
        console.error(`    SQL: ${q.generatedSql}`);
        console.error(`    Errors: ${result.errors.map((e) => e.message).join(', ')}`);
        totalErrors++;
      }
    }

    // Validate conversation SQL
    for (const conv of domain.conversations) {
      for (const msg of conv.messages) {
        if (msg.sql) {
          totalQueries++;
          const result = validator.validate(msg.sql);
          if (!result.valid) {
            console.error(`  INVALID SQL in conversation "${conv.title}": "${msg.content.slice(0, 50)}..."`);
            console.error(`    Errors: ${result.errors.map((e) => e.message).join(', ')}`);
            totalErrors++;
          }
        }
      }
    }

    // Validate metric expressions reference valid tables
    const tableNames = new Set(domain.tables.map((t) => t.name));
    for (const m of domain.metrics) {
      if (!tableNames.has(m.sourceTable)) {
        console.error(`  INVALID metric "${m.name}": sourceTable "${m.sourceTable}" not found`);
        totalErrors++;
      }
    }
  }

  console.log(`\n=== Validation Summary ===`);
  console.log(`Total domains: ${ALL_DOMAINS.length}`);
  console.log(`Total tables: ${ALL_DOMAINS.reduce((sum, d) => sum + d.tables.length, 0)}`);
  console.log(`Total queries validated: ${totalQueries}`);
  console.log(`Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

validate();
```

- [ ] **Step 2: Add validate script to package.json**

```json
"db:seed:validate": "tsx src/seed/validate.ts"
```

- [ ] **Step 3: Run validation**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter api db:seed:validate`
Expected: 0 errors, all SQL valid, all source tables exist.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/seed/validate.ts packages/api/package.json
git commit -m "feat(seed): add seed validation script — checks SQL validity and table references"
```

---

## Task 12: Run Full Seed

- [ ] **Step 1: Reset database (if needed)**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter @nl2sql/db drizzle-kit migrate`

- [ ] **Step 2: Run seed**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter api db:seed`
Expected: All 7 domains seeded, ~1000 tables created.

- [ ] **Step 3: Verify table count**

```bash
psql nl2sql -c "SELECT COUNT(*) FROM schema_tables;"
```
Expected: ~1000

- [ ] **Step 4: Verify metrics, glossary, conversations**

```bash
psql nl2sql -c "SELECT COUNT(*) FROM metrics;"
psql nl2sql -c "SELECT COUNT(*) FROM glossary_entries;"
psql nl2sql -c "SELECT COUNT(*) FROM conversations;"
psql nl2sql -c "SELECT COUNT(*) FROM query_history;"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(seed): complete enterprise seed — 1000+ tables across 7 domains with metrics, glossary, knowledge, and sample queries"
```
