import type { Pool } from 'pg';
import type { EngineSeedDefinition, TableDef, ColumnDef } from './engines/types.js';

/**
 * Map seed data types to PostgreSQL types.
 * All engines' tables are physically created in PostgreSQL for demo execution.
 */
const PG_TYPE_MAP: Record<string, string> = {
  BIGINT: 'BIGINT',
  INT: 'INTEGER',
  INTEGER: 'INTEGER',
  SMALLINT: 'SMALLINT',
  TINYINT: 'SMALLINT',
  STRING: 'TEXT',
  'VARCHAR(255)': 'VARCHAR(255)',
  TEXT: 'TEXT',
  'DECIMAL(18,2)': 'NUMERIC(18,2)',
  DOUBLE: 'DOUBLE PRECISION',
  FLOAT: 'REAL',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  TIMESTAMP: 'TIMESTAMP',
  DATETIME: 'TIMESTAMP',
  JSON: 'JSONB',
  JSONB: 'JSONB',
  ENUM: 'VARCHAR(50)',
  'ARRAY<STRING>': 'TEXT[]',
  'MAP<STRING,STRING>': 'JSONB',
};

function toPgType(seedType: string): string {
  const upper = seedType.toUpperCase();
  if (PG_TYPE_MAP[upper]) return PG_TYPE_MAP[upper];
  // Handle parameterized types: VARCHAR(N), DECIMAL(p,s), CHAR(N)
  const varcharMatch = upper.match(/^VARCHAR\((\d+)\)$/);
  if (varcharMatch) return `VARCHAR(${varcharMatch[1]})`;
  const decimalMatch = upper.match(/^DECIMAL\((\d+),(\d+)\)$/);
  if (decimalMatch) return `NUMERIC(${decimalMatch[1]},${decimalMatch[2]})`;
  const charMatch = upper.match(/^CHAR\((\d+)\)$/);
  if (charMatch) return `CHAR(${charMatch[1]})`;
  return 'TEXT';
}

function generateDDL(pgSchema: string, table: TableDef): string {
  const cols = table.columns.map((col) => {
    const pgType = toPgType(col.dataType);
    const nullable = col.isNullable === false ? ' NOT NULL' : '';
    const pk = col.isPrimaryKey ? ' PRIMARY KEY' : '';
    return `  "${col.name}" ${pgType}${nullable}${pk}`;
  });

  return `CREATE TABLE IF NOT EXISTS "${pgSchema}"."${table.name}" (\n${cols.join(',\n')}\n)`;
}

export async function createPhysicalSchemas(pool: Pool, engines: EngineSeedDefinition[]): Promise<void> {
  for (const engine of engines) {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${engine.pgSchema}"`);
  }
}

export async function createPhysicalTables(pool: Pool, engines: EngineSeedDefinition[]): Promise<number> {
  let count = 0;
  for (const engine of engines) {
    for (const table of engine.tables) {
      const ddl = generateDDL(engine.pgSchema, table);
      try {
        await pool.query(ddl);
        count++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[physical-tables] Failed to create ${engine.pgSchema}.${table.name}: ${msg}\n`);
      }
    }
  }
  return count;
}

/**
 * Generate realistic sample data for a single table.
 * Returns rows as arrays of column values.
 */
function generateRows(table: TableDef, rowCount: number): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of table.columns) {
      row[col.name] = generateValue(col, i, rowCount, table.domain);
    }
    rows.push(row);
  }

  return rows;
}

function generateValue(
  col: ColumnDef,
  index: number,
  totalRows: number,
  domain: string,
): unknown {
  const upper = col.dataType.toUpperCase();

  // Array types → PostgreSQL TEXT[] literal
  if (upper.startsWith('ARRAY') || upper.includes('[]')) {
    const items = [`item_${index % 5 + 1}`, `item_${(index + 1) % 5 + 1}`];
    return `{${items.join(',')}}`;
  }

  // Map/JSON types → valid JSONB object
  if (upper.startsWith('MAP') || upper === 'JSON' || upper === 'JSONB') {
    return JSON.stringify({ [`key_${index % 3}`]: `value_${index % 10}` });
  }

  // If has sample values, pick from them
  if (col.sampleValues && col.sampleValues.length > 0) {
    return col.sampleValues[index % col.sampleValues.length];
  }

  // Primary key — sequential
  if (col.isPrimaryKey) {
    return domainIdOffset(domain) + index + 1;
  }

  // FK / ID references
  if (col.name.endsWith('_id') || col.referencesTable) {
    return (index % 50) + 1;
  }

  // Date partition column
  if (col.name === 'ds') {
    return dateOffset(index, totalRows);
  }

  // Temporal columns
  if (['DATETIME', 'TIMESTAMP'].includes(upper)) {
    return timestampOffset(index, totalRows);
  }
  if (upper === 'DATE') {
    return dateOffset(index, totalRows);
  }

  // Numeric columns — generate realistic distributions
  if (['BIGINT', 'INT', 'INTEGER', 'SMALLINT', 'TINYINT'].includes(upper)) {
    if (col.name.includes('count') || col.name.includes('num')) {
      return Math.floor(Math.random() * 500) + 1;
    }
    if (col.name.includes('rank')) {
      return index + 1;
    }
    return Math.floor(Math.random() * 10000) + 1;
  }

  if (['DECIMAL(18,2)', 'DOUBLE', 'FLOAT'].includes(upper)) {
    if (col.name.includes('rate') || col.name.includes('ratio')) {
      return Number((Math.random() * 100).toFixed(2));
    }
    if (col.name.includes('amount') || col.name.includes('price') || col.name.includes('gmv') || col.name.includes('revenue')) {
      return Number((Math.random() * 5000 + 10).toFixed(2));
    }
    if (col.name.includes('score')) {
      return Number((Math.random() * 100).toFixed(2));
    }
    return Number((Math.random() * 1000).toFixed(2));
  }

  if (upper === 'BOOLEAN') {
    return Math.random() > 0.3;
  }

  // Common business columns — realistic Chinese values
  const semanticValue = getSemanticValue(col.name, index);
  if (semanticValue !== undefined) return semanticValue;

  // Text fallback with readable names
  if (col.name.includes('name') || col.name.includes('title')) {
    return `${col.comment?.slice(0, 4) ?? col.name}_${index + 1}`;
  }

  if (col.name.includes('desc') || col.name.includes('remark') || col.name.includes('reason')) {
    return `${col.comment ?? col.name} #${index + 1}`;
  }

  return `val_${index + 1}`;
}

/** Map common column names to realistic business values */
function getSemanticValue(colName: string, index: number): string | undefined {
  const pools: Record<string, string[]> = {
    city: ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '重庆', '苏州', '西安', '长沙'],
    region: ['华东', '华南', '华北', '华中', '西南', '西北', '东北'],
    region_name: ['华东', '华南', '华北', '华中', '西南', '西北', '东北'],
    province: ['广东', '浙江', '江苏', '北京', '上海', '四川', '湖北', '湖南', '山东', '福建'],
    country: ['中国', '美国', '日本', '韩国', '英国', '德国', '法国', '澳大利亚'],
    channel: ['App', 'H5', '小程序', 'PC Web', '线下门店'],
    platform: ['iOS', 'Android', 'Web', '小程序'],
    device_type: ['iPhone', 'Android', 'iPad', 'Desktop', 'Mobile'],
    category: ['电子产品', '服装鞋帽', '食品饮料', '家居用品', '美妆个护', '母婴用品', '运动户外', '图书文娱'],
    category_name: ['电子产品', '服装鞋帽', '食品饮料', '家居用品', '美妆个护', '母婴用品', '运动户外', '图书文娱'],
    brand: ['Apple', 'Nike', '华为', '小米', '阿迪达斯', '优衣库', '戴森', '雀巢'],
    brand_name: ['Apple', 'Nike', '华为', '小米', '阿迪达斯', '优衣库', '戴森', '雀巢'],
    gender: ['男', '女'],
    age_group: ['18-24', '25-34', '35-44', '45-54', '55+'],
    user_tier: ['高价值', '中价值', '低价值', '新用户', '流失用户'],
    payment_method: ['支付宝', '微信支付', '银行卡', '信用卡', 'Apple Pay'],
    order_status: ['已完成', '待支付', '已发货', '已取消', '退款中'],
    status: ['active', 'inactive', 'pending', 'completed', 'cancelled'],
    risk_type: ['欺诈交易', '账户盗用', '恶意刷单', '虚假注册', '异常登录'],
    risk_level: ['高风险', '中风险', '低风险'],
    check_type: ['实名认证', 'KYC审核', '风控规则', '黑名单检查', '设备指纹'],
    seller_name: ['旗舰店A', '品牌直营B', '优选商家C', '海外代购D', '工厂直销E'],
    merchant_name: ['旗舰店A', '品牌直营B', '优选商家C', '海外代购D', '工厂直销E'],
    product_name: ['iPhone 16 Pro', 'MacBook Air M4', 'AirPods Pro 3', 'Nike Air Max', '华为 Mate 70'],
    step_name: ['浏览商品', '加入购物车', '提交订单', '完成支付', '确认收货'],
    event_type: ['page_view', 'click', 'add_to_cart', 'purchase', 'search', 'share'],
    action: ['浏览', '点击', '收藏', '加购', '下单', '支付'],
    source: ['自然搜索', '付费推广', '社交分享', '直接访问', '邮件营销'],
    tag: ['高消费', '活跃用户', '新注册', '沉默用户', '品牌忠诚'],
    cohort_date: ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-02-01'],
    user_name: ['张三', '李四', '王五', '赵六', '陈七', '刘八', '周九', '吴十'],
  };

  for (const [key, values] of Object.entries(pools)) {
    if (colName === key || colName.endsWith(`_${key}`)) {
      return values[index % values.length];
    }
  }

  return undefined;
}

function domainIdOffset(domain: string): number {
  const offsets: Record<string, number> = { trade: 100000, user: 200000, product: 300000, risk: 400000 };
  return offsets[domain] ?? 500000;
}

function dateOffset(index: number, totalRows: number): string {
  const base = new Date('2026-01-04');
  const daySpan = 90;
  const dayOffset = Math.floor((index / totalRows) * daySpan);
  const d = new Date(base.getTime() + dayOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

function timestampOffset(index: number, totalRows: number): string {
  const base = new Date('2026-01-04T00:00:00Z');
  const msSpan = 90 * 86400000;
  const msOffset = Math.floor((index / totalRows) * msSpan);
  const hourJitter = Math.floor(Math.random() * 86400000);
  return new Date(base.getTime() + msOffset + hourJitter).toISOString().replace('T', ' ').slice(0, 19);
}

export async function insertSampleData(
  pool: Pool,
  engines: EngineSeedDefinition[],
  rowsPerTable = 100,
): Promise<number> {
  let totalInserted = 0;

  for (const engine of engines) {
    for (const table of engine.tables) {
      try {
        const rows = generateRows(table, rowsPerTable);
        if (rows.length === 0) continue;

        const columns = table.columns.map((col) => `"${col.name}"`);
        const batchSize = 25;

        for (let batch = 0; batch < rows.length; batch += batchSize) {
          const chunk = rows.slice(batch, batch + batchSize);
          const values: unknown[] = [];
          const placeholders: string[] = [];

          for (let ri = 0; ri < chunk.length; ri++) {
            const row = chunk[ri];
            const rowPlaceholders = columns.map(
              (_, ci) => `$${ri * columns.length + ci + 1}`,
            );
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
            for (const col of table.columns) {
              values.push(row[col.name]);
            }
          }

          await pool.query(
            `INSERT INTO "${engine.pgSchema}"."${table.name}" (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
            values,
          );
        }

        totalInserted += rows.length;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[sample-data] Failed ${engine.pgSchema}.${table.name}: ${msg}\n`);
      }
    }
  }

  return totalInserted;
}
