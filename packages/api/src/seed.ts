/**
 * Seed script — 多场景测试数据，覆盖电商/金融风控/运维日志三大领域。
 * 创建 1 个项目 + 3 个数据源 + 19 张表 + 16 个指标 + 15 条术语 + 3 篇知识文档。
 *
 * Usage: tsx packages/api/src/seed.ts
 */
import pino from 'pino';
import { createDbClient } from '@nl2sql/db';
import { ProjectService } from './services/project-service.js';
import { DatasourceService } from './services/datasource-service.js';
import { SchemaService } from './services/schema-service.js';
import { MetricService } from './services/metric-service.js';
import { KnowledgeService } from './services/knowledge-service.js';

const logger = pino({ level: 'info' });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  logger.error('DATABASE_URL is required');
  process.exit(1);
}

/* ================================================================== */
/*  DDL                                                                */
/* ================================================================== */

/** 电商 — 9 张表 */
const ECOM_DDL = `
CREATE TABLE users (
  id BIGINT PRIMARY KEY COMMENT '用户ID', username VARCHAR(50) NOT NULL COMMENT '用户名',
  email VARCHAR(200) COMMENT '邮箱', phone VARCHAR(20) COMMENT '手机号',
  gender VARCHAR(10) COMMENT '性别: male/female', city VARCHAR(50) COMMENT '所在城市',
  register_date DATE NOT NULL COMMENT '注册日期', last_login TIMESTAMP COMMENT '最后登录时间',
  status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/inactive/banned'
) COMMENT='平台用户表';

CREATE TABLE products (
  id BIGINT PRIMARY KEY COMMENT '商品ID', name VARCHAR(200) NOT NULL COMMENT '商品名称',
  category VARCHAR(50) NOT NULL COMMENT '分类: 电子/服装/食品/家居/美妆',
  price DECIMAL(10,2) NOT NULL COMMENT '单价', cost DECIMAL(10,2) COMMENT '成本价',
  stock INT DEFAULT 0 COMMENT '库存', brand VARCHAR(100) COMMENT '品牌',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上架时间'
) COMMENT='商品表';

CREATE TABLE orders (
  id BIGINT PRIMARY KEY COMMENT '订单ID',
  user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '下单用户ID',
  order_date DATE NOT NULL COMMENT '下单日期',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额',
  payment_amount DECIMAL(10,2) NOT NULL COMMENT '实付金额',
  status VARCHAR(20) NOT NULL COMMENT '状态: pending/paid/shipped/completed/cancelled/refunded',
  channel VARCHAR(30) COMMENT '渠道: app/web/mini_program/h5',
  region VARCHAR(50) COMMENT '收货地区'
) COMMENT='订单表';

CREATE TABLE order_items (
  id BIGINT PRIMARY KEY COMMENT '明细ID',
  order_id BIGINT NOT NULL REFERENCES orders(id) COMMENT '订单ID',
  product_id BIGINT NOT NULL REFERENCES products(id) COMMENT '商品ID',
  quantity INT NOT NULL COMMENT '数量', unit_price DECIMAL(10,2) NOT NULL COMMENT '单价',
  subtotal DECIMAL(10,2) NOT NULL COMMENT '小计'
) COMMENT='订单明细表';

CREATE TABLE user_events (
  id BIGINT PRIMARY KEY COMMENT '事件ID',
  user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '用户ID',
  event_type VARCHAR(30) NOT NULL COMMENT '类型: page_view/add_to_cart/purchase/search/login',
  event_date DATE NOT NULL COMMENT '日期', event_time TIMESTAMP NOT NULL COMMENT '时间',
  page VARCHAR(100) COMMENT '页面', device VARCHAR(20) COMMENT '设备: ios/android/web',
  session_id VARCHAR(50) COMMENT '会话ID'
) COMMENT='用户行为事件表';

CREATE TABLE coupons (
  id BIGINT PRIMARY KEY COMMENT '优惠券ID', code VARCHAR(50) NOT NULL COMMENT '券码',
  discount_type VARCHAR(20) NOT NULL COMMENT '类型: fixed/percentage',
  discount_value DECIMAL(10,2) NOT NULL COMMENT '折扣值',
  min_purchase DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费门槛',
  valid_from DATE NOT NULL COMMENT '生效日期', valid_to DATE NOT NULL COMMENT '失效日期',
  status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/expired/disabled'
) COMMENT='优惠券表';

CREATE TABLE reviews (
  id BIGINT PRIMARY KEY COMMENT '评价ID',
  user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '用户ID',
  product_id BIGINT NOT NULL REFERENCES products(id) COMMENT '商品ID',
  order_id BIGINT NOT NULL REFERENCES orders(id) COMMENT '订单ID',
  rating INT NOT NULL COMMENT '评分: 1-5', content TEXT COMMENT '评价内容',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评价时间'
) COMMENT='商品评价表';

CREATE TABLE inventory_logs (
  id BIGINT PRIMARY KEY COMMENT 'ID',
  product_id BIGINT NOT NULL REFERENCES products(id) COMMENT '商品ID',
  change_type VARCHAR(20) NOT NULL COMMENT '类型: inbound/outbound/adjustment/return',
  quantity_change INT NOT NULL COMMENT '变动量（正入负出）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '时间'
) COMMENT='库存变动日志表';

CREATE TABLE refunds (
  id BIGINT PRIMARY KEY COMMENT '退款ID',
  order_id BIGINT NOT NULL REFERENCES orders(id) COMMENT '订单ID',
  user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '用户ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '退款金额',
  reason VARCHAR(200) COMMENT '原因: quality_issue/wrong_item/not_needed/not_received',
  status VARCHAR(20) NOT NULL COMMENT '状态: pending/approved/rejected/completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间'
) COMMENT='退款表';
`;

/** 金融风控 — 5 张表 */
const FIN_DDL = `
CREATE TABLE accounts (
  id BIGINT PRIMARY KEY COMMENT '账户ID',
  customer_name VARCHAR(100) NOT NULL COMMENT '客户姓名',
  id_number VARCHAR(20) COMMENT '身份证号（脱敏）',
  account_type VARCHAR(20) NOT NULL COMMENT '类型: savings/checking/credit/loan',
  balance DECIMAL(15,2) DEFAULT 0 COMMENT '余额',
  credit_limit DECIMAL(15,2) COMMENT '信用额度',
  status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/frozen/closed',
  opened_date DATE NOT NULL COMMENT '开户日期'
) COMMENT='客户账户表';

CREATE TABLE transactions (
  id BIGINT PRIMARY KEY COMMENT '交易ID',
  account_id BIGINT NOT NULL REFERENCES accounts(id) COMMENT '账户ID',
  transaction_type VARCHAR(20) NOT NULL COMMENT '类型: deposit/withdrawal/transfer/payment/refund',
  amount DECIMAL(15,2) NOT NULL COMMENT '金额',
  merchant VARCHAR(200) COMMENT '商户',
  category VARCHAR(50) COMMENT '分类: dining/shopping/travel/entertainment/utilities',
  channel VARCHAR(20) COMMENT '渠道: online/atm/pos/mobile/counter',
  transaction_time TIMESTAMP NOT NULL COMMENT '时间',
  status VARCHAR(20) DEFAULT 'completed' COMMENT '状态: pending/completed/failed/reversed'
) COMMENT='交易流水表';

CREATE TABLE risk_events (
  id BIGINT PRIMARY KEY COMMENT '风险事件ID',
  account_id BIGINT NOT NULL REFERENCES accounts(id) COMMENT '账户ID',
  event_type VARCHAR(30) NOT NULL COMMENT '类型: suspicious_login/large_transfer/rapid_transactions/location_anomaly',
  risk_level VARCHAR(10) NOT NULL COMMENT '等级: low/medium/high/critical',
  description TEXT COMMENT '描述',
  detected_at TIMESTAMP NOT NULL COMMENT '检测时间',
  resolved_at TIMESTAMP COMMENT '处置时间',
  status VARCHAR(20) DEFAULT 'open' COMMENT '状态: open/investigating/resolved/false_positive'
) COMMENT='风险事件表';

CREATE TABLE loan_applications (
  id BIGINT PRIMARY KEY COMMENT '贷款申请ID',
  account_id BIGINT NOT NULL REFERENCES accounts(id) COMMENT '账户ID',
  loan_amount DECIMAL(15,2) NOT NULL COMMENT '申请金额',
  loan_term_months INT NOT NULL COMMENT '期限（月）',
  interest_rate DECIMAL(5,4) NOT NULL COMMENT '年利率',
  purpose VARCHAR(50) COMMENT '用途: housing/car/education/business/personal',
  status VARCHAR(20) NOT NULL COMMENT '状态: pending/approved/rejected/disbursed/closed',
  applied_at TIMESTAMP NOT NULL COMMENT '申请时间',
  approved_at TIMESTAMP COMMENT '审批时间'
) COMMENT='贷款申请表';

CREATE TABLE repayments (
  id BIGINT PRIMARY KEY COMMENT '还款ID',
  loan_id BIGINT NOT NULL REFERENCES loan_applications(id) COMMENT '贷款ID',
  period_number INT NOT NULL COMMENT '期数',
  amount DECIMAL(15,2) NOT NULL COMMENT '应还金额',
  principal DECIMAL(15,2) NOT NULL COMMENT '本金',
  interest DECIMAL(15,2) NOT NULL COMMENT '利息',
  due_date DATE NOT NULL COMMENT '应还日期',
  paid_date DATE COMMENT '实际还款日期',
  status VARCHAR(20) NOT NULL COMMENT '状态: upcoming/paid/overdue/partial'
) COMMENT='还款计划表';
`;

/** 运维日志 — 5 张表 */
const OPS_DDL = `
CREATE TABLE services (
  id BIGINT PRIMARY KEY COMMENT '服务ID', name VARCHAR(100) NOT NULL COMMENT '服务名',
  team VARCHAR(50) NOT NULL COMMENT '团队',
  environment VARCHAR(20) NOT NULL COMMENT '环境: production/staging/development',
  language VARCHAR(30) COMMENT '语言: java/go/python/nodejs',
  status VARCHAR(20) DEFAULT 'running' COMMENT '状态: running/stopped/degraded',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间'
) COMMENT='微服务注册表';

CREATE TABLE deployments (
  id BIGINT PRIMARY KEY COMMENT '部署ID',
  service_id BIGINT NOT NULL REFERENCES services(id) COMMENT '服务ID',
  version VARCHAR(50) NOT NULL COMMENT '版本', deployer VARCHAR(50) NOT NULL COMMENT '部署人',
  deploy_type VARCHAR(20) COMMENT '方式: rolling/blue_green/canary',
  status VARCHAR(20) NOT NULL COMMENT '状态: pending/running/success/failed/rollback',
  started_at TIMESTAMP NOT NULL COMMENT '开始', completed_at TIMESTAMP COMMENT '完成'
) COMMENT='部署记录表';

CREATE TABLE incidents (
  id BIGINT PRIMARY KEY COMMENT '事件ID',
  service_id BIGINT NOT NULL REFERENCES services(id) COMMENT '服务ID',
  severity VARCHAR(10) NOT NULL COMMENT '级别: P0/P1/P2/P3',
  title VARCHAR(200) NOT NULL COMMENT '标题', description TEXT COMMENT '描述',
  root_cause TEXT COMMENT '根因',
  status VARCHAR(20) NOT NULL COMMENT '状态: open/mitigated/resolved/postmortem',
  created_at TIMESTAMP NOT NULL COMMENT '发现时间', resolved_at TIMESTAMP COMMENT '恢复时间'
) COMMENT='故障事件表';

CREATE TABLE metrics_logs (
  id BIGINT PRIMARY KEY COMMENT 'ID',
  service_id BIGINT NOT NULL REFERENCES services(id) COMMENT '服务ID',
  metric_name VARCHAR(50) NOT NULL COMMENT '指标: p99_latency/error_rate/cpu_usage/memory_usage/qps',
  value DECIMAL(15,4) NOT NULL COMMENT '值',
  unit VARCHAR(20) COMMENT '单位: ms/percent/cores/mb/req_per_sec',
  recorded_at TIMESTAMP NOT NULL COMMENT '采集时间'
) COMMENT='服务性能指标采集表';

CREATE TABLE alerts (
  id BIGINT PRIMARY KEY COMMENT '告警ID',
  service_id BIGINT NOT NULL REFERENCES services(id) COMMENT '服务ID',
  alert_type VARCHAR(30) NOT NULL COMMENT '类型: threshold/anomaly/heartbeat/custom',
  severity VARCHAR(10) NOT NULL COMMENT '级别: info/warning/critical/fatal',
  message TEXT NOT NULL COMMENT '内容',
  triggered_at TIMESTAMP NOT NULL COMMENT '触发时间',
  resolved_at TIMESTAMP COMMENT '恢复时间',
  acknowledged_by VARCHAR(50) COMMENT '确认人'
) COMMENT='告警记录表';
`;

/* ================================================================== */
/*  指标                                                               */
/* ================================================================== */

type Op = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN';
type Fmt = 'number' | 'percentage' | 'currency';
type MType = 'atomic' | 'derived' | 'composite';
interface MetricDef {
  name: string;
  displayName: string;
  expression: string;
  metricType: MType;
  sourceTable: string;
  format: Fmt;
  filters?: Array<{ column: string; op: Op; value: string | number }>;
  dimensions?: string[];
  granularity?: string[];
  description?: string;
}

/* prettier-ignore */
const ECOM_METRICS: MetricDef[] = [
  { name: 'gmv', displayName: 'GMV（成交总额）', expression: 'SUM(total_amount)', metricType: 'atomic', sourceTable: 'orders', format: 'currency', filters: [{ column: 'status', op: '=', value: 'completed' }], dimensions: ['region', 'channel', 'order_date'], granularity: ['day', 'week', 'month'] },
  { name: 'order_count', displayName: '订单数', expression: 'COUNT(*)', metricType: 'atomic', sourceTable: 'orders', format: 'number', dimensions: ['region', 'channel', 'status', 'order_date'], granularity: ['day', 'week', 'month'] },
  { name: 'avg_order_value', displayName: '客单价', expression: 'AVG(payment_amount)', metricType: 'atomic', sourceTable: 'orders', format: 'currency', filters: [{ column: 'status', op: '=', value: 'completed' }], dimensions: ['region', 'channel'] },
  { name: 'paying_users', displayName: '付费用户数', expression: 'COUNT(DISTINCT user_id)', metricType: 'atomic', sourceTable: 'orders', format: 'number', filters: [{ column: 'status', op: '=', value: 'completed' }] },
  { name: 'refund_rate', displayName: '退款率', expression: 'COUNT(DISTINCT refunds.order_id) * 100.0 / NULLIF(COUNT(DISTINCT orders.id), 0)', metricType: 'derived', sourceTable: 'orders', format: 'percentage', description: '退款订单数 / 总订单数' },
  { name: 'review_avg_rating', displayName: '平均评分', expression: 'AVG(rating)', metricType: 'atomic', sourceTable: 'reviews', format: 'number', dimensions: ['product_id'], description: '商品平均评分（1-5）' },
  { name: 'coupon_usage_rate', displayName: '优惠券使用率', expression: 'COUNT(CASE WHEN discount_amount > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)', metricType: 'derived', sourceTable: 'orders', format: 'percentage', description: '使用优惠券的订单占比' },
];

/* prettier-ignore */
const FIN_METRICS: MetricDef[] = [
  { name: 'total_transaction_volume', displayName: '总交易额', expression: 'SUM(amount)', metricType: 'atomic', sourceTable: 'transactions', format: 'currency', filters: [{ column: 'status', op: '=', value: 'completed' }], dimensions: ['category', 'channel', 'transaction_type'], granularity: ['day', 'week', 'month'] },
  { name: 'risk_event_count', displayName: '风险事件数', expression: 'COUNT(*)', metricType: 'atomic', sourceTable: 'risk_events', format: 'number', dimensions: ['event_type', 'risk_level', 'status'], granularity: ['day', 'week', 'month'] },
  { name: 'loan_approval_rate', displayName: '贷款通过率', expression: "COUNT(CASE WHEN status IN ('approved','disbursed','closed') THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)", metricType: 'derived', sourceTable: 'loan_applications', format: 'percentage', description: '审批通过的贷款申请占比' },
  { name: 'overdue_rate', displayName: '逾期率', expression: "COUNT(CASE WHEN status = 'overdue' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)", metricType: 'derived', sourceTable: 'repayments', format: 'percentage', description: '逾期还款笔数占比' },
  { name: 'avg_transaction_amount', displayName: '笔均交易额', expression: 'AVG(amount)', metricType: 'atomic', sourceTable: 'transactions', format: 'currency', filters: [{ column: 'status', op: '=', value: 'completed' }], dimensions: ['category', 'channel'] },
];

/* prettier-ignore */
const OPS_METRICS: MetricDef[] = [
  { name: 'deployment_frequency', displayName: '部署频率', expression: 'COUNT(*)', metricType: 'atomic', sourceTable: 'deployments', format: 'number', filters: [{ column: 'status', op: '=', value: 'success' }], dimensions: ['service_id', 'deploy_type'], granularity: ['day', 'week', 'month'], description: '成功部署次数' },
  { name: 'incident_mttr', displayName: 'MTTR（分钟）', expression: 'AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)', metricType: 'atomic', sourceTable: 'incidents', format: 'number', filters: [{ column: 'status', op: '=', value: 'resolved' }], dimensions: ['severity', 'service_id'], description: '平均恢复分钟数' },
  { name: 'alert_count', displayName: '告警数', expression: 'COUNT(*)', metricType: 'atomic', sourceTable: 'alerts', format: 'number', dimensions: ['alert_type', 'severity', 'service_id'], granularity: ['day', 'week', 'month'] },
  { name: 'service_availability', displayName: '服务可用性', expression: "(1 - SUM(CASE WHEN metric_name = 'error_rate' THEN value ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100", metricType: 'derived', sourceTable: 'metrics_logs', format: 'percentage', description: '基于 error_rate 计算的可用性' },
];

/* ================================================================== */
/*  术语表 — 15 条                                                     */
/* ================================================================== */

/* prettier-ignore */
const GLOSSARY: Array<{ term: string; sqlExpression: string; description: string }> = [
  { term: '活跃用户', sqlExpression: "WHERE last_login > NOW() - INTERVAL '30 days'", description: '30天内有登录行为的用户' },
  { term: '新用户', sqlExpression: "WHERE register_date > NOW() - INTERVAL '7 days'", description: '7天内注册的用户' },
  { term: '高价值用户', sqlExpression: "WHERE user_id IN (SELECT user_id FROM orders WHERE status = 'completed' GROUP BY user_id HAVING SUM(payment_amount) > 10000)", description: '累计消费超过1万元的用户' },
  { term: '复购率', sqlExpression: 'COUNT(DISTINCT CASE WHEN order_count > 1 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id)', description: '有2次及以上购买的用户占比' },
  { term: '转化率', sqlExpression: "COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN user_id END), 0)", description: '购买用户占访问用户比例' },
  { term: '客单价', sqlExpression: "AVG(payment_amount) WHERE status = 'completed'", description: '已完成订单的平均实付金额' },
  { term: '逾期率', sqlExpression: "COUNT(CASE WHEN status = 'overdue' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)", description: '逾期还款笔数占总还款计划笔数比例' },
  { term: '不良贷款', sqlExpression: "WHERE status = 'overdue' AND due_date < NOW() - INTERVAL '90 days'", description: '逾期超过90天的贷款' },
  { term: '可疑交易', sqlExpression: "WHERE risk_level IN ('high', 'critical') AND status = 'open'", description: '高/极高风险且未处置的事件关联交易' },
  { term: '信用额度使用率', sqlExpression: "(credit_limit - balance) * 100.0 / NULLIF(credit_limit, 0) WHERE account_type = 'credit'", description: '已用额度占总额度百分比' },
  { term: 'MTTR', sqlExpression: 'AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)', description: 'Mean Time To Recovery，平均故障恢复时间（分钟）' },
  { term: 'P99延迟', sqlExpression: "PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) WHERE metric_name = 'p99_latency'", description: '99%请求的响应时间上限（ms）' },
  { term: '部署频率', sqlExpression: "COUNT(*) WHERE status = 'success' GROUP BY date_trunc('week', started_at)", description: '每周成功部署次数' },
  { term: '服务可用性', sqlExpression: '(1 - SUM(downtime_minutes) / (24 * 60)) * 100', description: '可用时间占比，SLO >= 99.95%' },
  { term: '告警风暴', sqlExpression: "COUNT(*) > 50 WITHIN INTERVAL '10 minutes'", description: '10分钟内 > 50 条告警，通常意味着级联故障' },
];

/* ================================================================== */
/*  知识文档 — 3 篇                                                    */
/* ================================================================== */

const DOCS: Array<{ title: string; docType: 'document'; content: string }> = [
  {
    title: '电商业务数据字典',
    docType: 'document',
    content: [
      '# 电商业务数据字典',
      '## 订单生命周期',
      'pending → paid → shipped → completed。取消：pending/paid 可 cancelled，completed 可 refunded。',
      '## GMV 与实付金额',
      "GMV = SUM(total_amount) WHERE status='completed'。实付 = total_amount - discount_amount = payment_amount。计算收入用 payment_amount，交易规模用 total_amount。",
      '## 用户分层',
      '新用户（注册7天内）、活跃（30天内登录）、高价值（累计消费>1万）、沉默（30-90天未登录）、流失（>90天未登录）。',
      '## 渠道',
      'app=原生App, web=PC浏览器, mini_program=小程序, h5=移动H5。',
      '## 退款',
      '退款金额 <= payment_amount。退款率 = 退款订单 / 已完成订单（排除 pending/cancelled）。',
    ].join('\n'),
  },
  {
    title: '金融风控规则说明',
    docType: 'document',
    content: [
      '# 金融风控规则说明',
      '## 风险等级',
      'low=自动标记无需人工, medium=人工复核, high=冻结账户+高级处置, critical=冻结+报送监管+通知客户。',
      '## 触发规则',
      '1. 单笔>5万→large_transfer 2. 10min>20笔→rapid_transactions 3. 距上次>500km→location_anomaly 4. 非常用设备+异地IP→suspicious_login',
      '## 逾期定义',
      '正常: paid_date<=due_date。逾期: paid_date>due_date。不良贷款: 逾期>=90天。坏账: 逾期>=180天。',
      '## 贷款审批',
      '申请→模型评分→人工复核(>100万)→审批/拒绝→放款。通过率=approved/(approved+rejected)，不含pending。',
    ].join('\n'),
  },
  {
    title: '运维SLO标准',
    docType: 'document',
    content: [
      '# 运维 SLO 标准',
      '## 可用性',
      'Tier-1(核心): 99.99%(月宕~4min), Tier-2(关键): 99.95%(~22min), Tier-3(辅助): 99.9%(~44min)。',
      '## 延迟',
      'P50<50ms, P95<200ms, P99<500ms, P99.9<1000ms。',
      '## 故障级别',
      'P0: 全面不可用，30min响应2h恢复。P1: 严重降级，1h响应4h恢复。P2: 部分影响，4h响应24h修复。P3: 轻微，下一工作日。',
      '## DORA 基准',
      '部署频率:Elite每天多次。Lead Time<1天。MTTR<1小时。变更失败率<15%。',
      '## 告警',
      '必须actionable。风暴:10min同服务>50条。收敛:相同type+service 5min内只通知一次。',
    ].join('\n'),
  },
];

/* ================================================================== */
/*  执行                                                               */
/* ================================================================== */

/** 从 ingest 结果中按表名查找 table ID */
function findTableId(
  tables: Array<{ table: { id: string; name: string } }>,
  name: string,
  ds: string,
): string {
  const t = tables.find((r) => r.table.name === name);
  if (!t) throw new Error(`Table "${name}" not found in "${ds}"`);
  return t.table.id;
}

async function seed() {
  const db = createDbClient(DATABASE_URL!);
  const projSvc = new ProjectService(db);
  const dsSvc = new DatasourceService(db);
  const schemaSvc = new SchemaService(db);
  const metricSvc = new MetricService(db);
  const knowledgeSvc = new KnowledgeService(db);

  logger.info('=== NL2SQL Seed 开始 ===');

  /* 项目 */
  const project = await projSvc.create({
    name: 'NL2SQL 多场景演示',
    description: '覆盖电商分析、金融风控、运维日志三大领域',
  });

  /* 数据源 + schema */
  const ecomDs = await dsSvc.create({
    projectId: project.id,
    name: '电商主库',
    dialect: 'postgresql',
  });
  const ecom = await schemaSvc.ingestDdl(ecomDs.id, ECOM_DDL);
  logger.info({ tables: ecom.tables.length, rels: ecom.relationships.length }, '电商 schema');

  const finDs = await dsSvc.create({ projectId: project.id, name: '金融风控库', dialect: 'mysql' });
  const fin = await schemaSvc.ingestDdl(finDs.id, FIN_DDL);
  logger.info({ tables: fin.tables.length, rels: fin.relationships.length }, '金融 schema');

  const opsDs = await dsSvc.create({
    projectId: project.id,
    name: '运维日志库',
    dialect: 'postgresql',
  });
  const ops = await schemaSvc.ingestDdl(opsDs.id, OPS_DDL);
  logger.info({ tables: ops.tables.length, rels: ops.relationships.length }, '运维 schema');

  /* 指标 */
  const groups: Array<{ defs: MetricDef[]; tables: typeof ecom.tables; label: string }> = [
    { defs: ECOM_METRICS, tables: ecom.tables, label: '电商' },
    { defs: FIN_METRICS, tables: fin.tables, label: '金融' },
    { defs: OPS_METRICS, tables: ops.tables, label: '运维' },
  ];
  let metricCount = 0;
  for (const { defs, tables, label } of groups) {
    for (const m of defs) {
      await metricSvc.create({
        projectId: project.id,
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        expression: m.expression,
        metricType: m.metricType,
        sourceTableId: findTableId(tables, m.sourceTable, label),
        filters: m.filters,
        dimensions: m.dimensions,
        granularity: m.granularity,
        format: m.format,
      });
      metricCount++;
    }
  }
  logger.info({ count: metricCount }, '指标');

  /* 术语 */
  for (const g of GLOSSARY) {
    await knowledgeSvc.createGlossaryEntry({ projectId: project.id, ...g });
  }
  logger.info({ count: GLOSSARY.length }, '术语');

  /* 知识文档 */
  for (const d of DOCS) {
    await knowledgeSvc.createDoc({ projectId: project.id, ...d });
  }
  logger.info({ count: DOCS.length }, '文档');

  /* 总结 */
  const totalT = ecom.tables.length + fin.tables.length + ops.tables.length;
  const totalR = ecom.relationships.length + fin.relationships.length + ops.relationships.length;
  logger.info(
    {
      projectId: project.id,
      datasources: 3,
      tables: totalT,
      relationships: totalR,
      metrics: metricCount,
      glossary: GLOSSARY.length,
      docs: DOCS.length,
    },
    '=== Seed 完成 ===',
  );

  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
