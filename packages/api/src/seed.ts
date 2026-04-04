/**
 * Seed script — sets up test data for end-to-end validation.
 * Creates a project, datasource, sample tables (via DDL ingest), and metrics.
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
  logger.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function seed() {
  const db = createDbClient(DATABASE_URL!);
  const projectService = new ProjectService(db);
  const datasourceService = new DatasourceService(db);
  const schemaService = new SchemaService(db);
  const metricService = new MetricService(db);
  const knowledgeService = new KnowledgeService(db);

  logger.info('Seeding NL2SQL test data...\n');

  // 1. Create project
  const project = await projectService.create({
    name: '电商数据分析',
    description: '示例电商平台数据，包含用户、订单、商品等核心表',
  });
  logger.info(`Project created: ${project.name} (${project.id})`);

  // 2. Create datasource
  const datasource = await datasourceService.create({
    projectId: project.id,
    name: '电商主库',
    dialect: 'postgresql',
  });
  logger.info(`Datasource created: ${datasource.name} (${datasource.id})`);

  // 3. Ingest DDL — sample e-commerce schema
  const ddl = `
    CREATE TABLE users (
      id BIGINT PRIMARY KEY COMMENT '用户ID',
      username VARCHAR(50) NOT NULL COMMENT '用户名',
      email VARCHAR(200) COMMENT '邮箱地址',
      phone VARCHAR(20) COMMENT '手机号',
      gender VARCHAR(10) COMMENT '性别: male/female',
      city VARCHAR(50) COMMENT '所在城市',
      register_date DATE NOT NULL COMMENT '注册日期',
      last_login TIMESTAMP COMMENT '最后登录时间',
      status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/inactive/banned'
    ) COMMENT='平台用户表';

    CREATE TABLE products (
      id BIGINT PRIMARY KEY COMMENT '商品ID',
      name VARCHAR(200) NOT NULL COMMENT '商品名称',
      category VARCHAR(50) NOT NULL COMMENT '商品分类: 电子/服装/食品/家居/美妆',
      price DECIMAL(10,2) NOT NULL COMMENT '商品单价',
      cost DECIMAL(10,2) COMMENT '成本价',
      stock INT DEFAULT 0 COMMENT '库存数量',
      brand VARCHAR(100) COMMENT '品牌',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上架时间'
    ) COMMENT='商品表';

    CREATE TABLE orders (
      id BIGINT PRIMARY KEY COMMENT '订单ID',
      user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '下单用户ID',
      order_date DATE NOT NULL COMMENT '下单日期',
      total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
      discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额',
      payment_amount DECIMAL(10,2) NOT NULL COMMENT '实付金额',
      status VARCHAR(20) NOT NULL COMMENT '订单状态: pending/paid/shipped/completed/cancelled/refunded',
      channel VARCHAR(30) COMMENT '下单渠道: app/web/mini_program/h5',
      region VARCHAR(50) COMMENT '收货地区'
    ) COMMENT='订单表';

    CREATE TABLE order_items (
      id BIGINT PRIMARY KEY COMMENT '订单明细ID',
      order_id BIGINT NOT NULL REFERENCES orders(id) COMMENT '所属订单ID',
      product_id BIGINT NOT NULL REFERENCES products(id) COMMENT '商品ID',
      quantity INT NOT NULL COMMENT '购买数量',
      unit_price DECIMAL(10,2) NOT NULL COMMENT '下单时单价',
      subtotal DECIMAL(10,2) NOT NULL COMMENT '小计金额'
    ) COMMENT='订单明细表';

    CREATE TABLE user_events (
      id BIGINT PRIMARY KEY COMMENT '事件ID',
      user_id BIGINT NOT NULL REFERENCES users(id) COMMENT '用户ID',
      event_type VARCHAR(30) NOT NULL COMMENT '事件类型: page_view/add_to_cart/purchase/search/login',
      event_date DATE NOT NULL COMMENT '事件日期',
      event_time TIMESTAMP NOT NULL COMMENT '事件时间',
      page VARCHAR(100) COMMENT '页面路径',
      device VARCHAR(20) COMMENT '设备类型: ios/android/web',
      session_id VARCHAR(50) COMMENT '会话ID'
    ) COMMENT='用户行为事件表';
  `;

  const ingestResult = await schemaService.ingestDdl(datasource.id, ddl);
  logger.info(
    `Schema ingested: ${ingestResult.tables.length} tables, ${ingestResult.relationships.length} relationships`,
  );

  // 4. Create metrics
  const ordersTable = ingestResult.tables.find((t) => t.table.name === 'orders');

  const metricsToCreate = [
    {
      name: 'gmv',
      displayName: 'GMV（成交总额）',
      expression: 'SUM(total_amount)',
      metricType: 'atomic' as const,
      sourceTableId: ordersTable?.table.id,
      filters: [{ column: 'status', op: '=' as const, value: 'completed' }],
      dimensions: ['region', 'channel', 'order_date'],
      granularity: ['day', 'week', 'month'],
      format: 'currency' as const,
    },
    {
      name: 'order_count',
      displayName: '订单数',
      expression: 'COUNT(*)',
      metricType: 'atomic' as const,
      sourceTableId: ordersTable?.table.id,
      dimensions: ['region', 'channel', 'status', 'order_date'],
      granularity: ['day', 'week', 'month'],
      format: 'number' as const,
    },
    {
      name: 'avg_order_value',
      displayName: '客单价',
      expression: 'AVG(payment_amount)',
      metricType: 'atomic' as const,
      sourceTableId: ordersTable?.table.id,
      filters: [{ column: 'status', op: '=' as const, value: 'completed' }],
      dimensions: ['region', 'channel'],
      format: 'currency' as const,
    },
    {
      name: 'paying_users',
      displayName: '付费用户数',
      expression: 'COUNT(DISTINCT user_id)',
      metricType: 'atomic' as const,
      sourceTableId: ordersTable?.table.id,
      filters: [{ column: 'status', op: '=' as const, value: 'completed' }],
      format: 'number' as const,
    },
  ];

  for (const m of metricsToCreate) {
    const metric = await metricService.create({
      projectId: project.id,
      ...m,
    });
    logger.info(`Metric created: ${metric.displayName}`);
  }

  // 5. Create glossary entries
  const glossaryEntries = [
    {
      term: '活跃用户',
      sqlExpression: "WHERE last_login > NOW() - INTERVAL '30 days'",
      description: '30天内有登录行为的用户',
    },
    {
      term: '新用户',
      sqlExpression: "WHERE register_date > NOW() - INTERVAL '7 days'",
      description: '7天内注册的用户',
    },
    {
      term: '高价值用户',
      sqlExpression:
        "WHERE user_id IN (SELECT user_id FROM orders WHERE status = 'completed' GROUP BY user_id HAVING SUM(payment_amount) > 10000)",
      description: '累计消费超过1万元的用户',
    },
    {
      term: '复购率',
      sqlExpression:
        'COUNT(DISTINCT CASE WHEN order_count > 1 THEN user_id END) * 100.0 / COUNT(DISTINCT user_id)',
      description: '有2次及以上购买的用户占比',
    },
  ];

  for (const entry of glossaryEntries) {
    await knowledgeService.createGlossaryEntry({
      projectId: project.id,
      ...entry,
    });
    logger.info(`Glossary entry created: ${entry.term}`);
  }

  logger.info('\n✅ Seed complete!');
  logger.info(`\nProject ID: ${project.id}`);
  logger.info(`Datasource ID: ${datasource.id}`);
  logger.info('\nStart the servers and open http://localhost:3000');
  logger.info('Select project "电商数据分析" and datasource "电商主库" in the sidebar');

  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
