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

  // Business numbers / codes (ORD000100001, PAY000200002...)
  if (col.name.endsWith('_no') || col.name.endsWith('_code') || col.name === 'barcode') {
    const prefix = col.name.replace(/_(no|code)$/, '').toUpperCase().slice(0, 3);
    return `${prefix}${String(domainIdOffset(domain) + index + 1).padStart(12, '0')}`;
  }

  // IP addresses
  if (col.name === 'ip' || col.name.includes('ip_address') || col.name.endsWith('_ip')) {
    return `192.168.${index % 255}.${(index * 7 + 1) % 255}`;
  }

  // Phone numbers
  if (col.name.includes('phone') || col.name.includes('mobile') || col.name.includes('tel')) {
    return `138${String(10000000 + index).slice(-8)}`;
  }

  // Email
  if (col.name.includes('email')) {
    return `user${index + 1}@example.com`;
  }

  // URLs
  if (col.name.includes('url') || col.name.includes('link') || col.name.includes('logo')) {
    return `https://cdn.example.com/${col.name}/${index + 1}.png`;
  }

  // Paths
  if (col.name.includes('path')) {
    return `/${col.name.replace(/_path$/, '')}/${index + 1}`;
  }

  // Content / review / comment / detail text
  if (col.name.includes('content') || col.name.includes('comment') || col.name.includes('detail') || col.name.includes('feedback')) {
    const texts = ['商品质量很好，物流很快', '性价比不错，推荐购买', '包装完整，与描述相符', '客服态度好，响应及时', '使用体验一般，有待改进', '颜色和图片一致，很满意', '发货速度快，次日达', '做工精细，超出预期'];
    return texts[index % texts.length];
  }

  // Names / titles
  if (col.name.includes('name') || col.name.includes('title')) {
    return `${col.comment?.slice(0, 4) ?? col.name}_${index + 1}`;
  }

  // Descriptions / remarks / reasons
  if (col.name.includes('desc') || col.name.includes('remark') || col.name.includes('reason')) {
    return `${col.comment ?? col.name} #${index + 1}`;
  }

  // Generic _type columns — derive from comment
  if (col.name.endsWith('_type')) {
    const typeValues = ['type_a', 'type_b', 'type_c', 'type_d'];
    return typeValues[index % typeValues.length];
  }

  // Generic _level / _tier / _stage columns
  if (col.name.endsWith('_level') || col.name.endsWith('_tier') || col.name.endsWith('_stage')) {
    const levels = ['high', 'medium', 'low'];
    return levels[index % levels.length];
  }

  // Version strings
  if (col.name.includes('version')) {
    const versions = ['v1.0.0', 'v1.1.0', 'v2.0.0', 'v2.1.0', 'v3.0.0'];
    return versions[index % versions.length];
  }

  // Fallback — use column comment for context
  if (col.comment) {
    return `${col.comment.slice(0, 6)}_${index + 1}`;
  }

  return `${col.name}_${index + 1}`;
}

/** Map common column names to realistic business values */
function getSemanticValue(colName: string, index: number): string | undefined {
  const pools: Record<string, string[]> = {
    // ── Geography ──
    city: ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '重庆', '苏州', '西安', '长沙'],
    district: ['朝阳区', '海淀区', '南山区', '浦东新区', '天河区', '武侯区', '江干区', '雨花台区', '福田区', '西湖区'],
    region: ['华东', '华南', '华北', '华中', '西南', '西北', '东北'],
    region_name: ['华东', '华南', '华北', '华中', '西南', '西北', '东北'],
    province: ['广东', '浙江', '江苏', '北京', '上海', '四川', '湖北', '湖南', '山东', '福建'],
    country: ['中国', '美国', '日本', '韩国', '英国', '德国', '法国', '澳大利亚'],
    address: ['朝阳区建国路88号', '浦东新区陆家嘴环路1000号', '南山区科技园南路1号', '西湖区文三路398号'],
    zip_code: ['100000', '200000', '510000', '310000', '610000', '430000'],
    zipcode: ['100000', '200000', '510000', '310000', '610000', '430000'],
    city_tier: ['一线', '新一线', '二线', '三线', '四线'],
    region_tier: ['一线', '新一线', '二线', '三线'],
    geo_location: ['39.9042,116.4074', '31.2304,121.4737', '22.5431,114.0579', '30.2741,120.1551'],

    // ── Channel / Platform / Device ──
    channel: ['App', 'H5', '小程序', 'PC Web', '线下门店'],
    channel_name: ['App', 'H5', '小程序', 'PC Web', '线下门店'],
    platform: ['iOS', 'Android', 'Web', '小程序'],
    device_type: ['iPhone', 'Android', 'iPad', 'Desktop', 'Mobile'],
    device_model: ['iPhone 16 Pro', 'iPhone 15', 'Huawei Mate 70', 'Samsung Galaxy S25', 'Xiaomi 15', 'iPad Pro'],
    os: ['iOS', 'Android', 'Windows', 'macOS', 'Linux'],
    os_version: ['iOS 19.0', 'iOS 18.2', 'Android 15', 'Android 14', 'Windows 11', 'macOS 15.3'],
    app_version: ['4.8.0', '4.7.2', '4.6.1', '4.5.0', '3.9.9'],
    browser: ['Chrome', 'Safari', 'Firefox', 'Edge', 'WeChat Browser'],
    browser_type: ['Chrome', 'Safari', 'Firefox', 'Edge', 'WeChat Browser'],
    browser_ua: ['Mozilla/5.0 (iPhone; CPU iPhone OS 19_0)', 'Mozilla/5.0 (Linux; Android 15)', 'Mozilla/5.0 (Windows NT 10.0)'],
    screen_resolution: ['1920x1080', '2560x1440', '1080x2400', '750x1334', '1170x2532'],
    carrier: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '京东物流', '极兔速递'],
    device_fingerprint: ['fp_a1b2c3d4', 'fp_e5f6g7h8', 'fp_i9j0k1l2', 'fp_m3n4o5p6'],

    // ── Product / Commerce ──
    category: ['电子产品', '服装鞋帽', '食品饮料', '家居用品', '美妆个护', '母婴用品', '运动户外', '图书文娱'],
    category_name: ['电子产品', '服装鞋帽', '食品饮料', '家居用品', '美妆个护', '母婴用品', '运动户外', '图书文娱'],
    category_l1: ['电子产品', '服装鞋帽', '食品饮料', '家居用品', '美妆个护'],
    category_l2: ['手机通讯', '男装', '休闲零食', '厨房用品', '面部护肤'],
    category_l3: ['智能手机', 'T恤', '坚果炒货', '锅具', '面膜'],
    category_path: ['数码/手机/智能手机', '服装/女装/连衣裙', '食品/零食/坚果', '家居/厨房/锅具'],
    brand: ['Apple', 'Nike', '华为', '小米', '阿迪达斯', '优衣库', '戴森', '雀巢'],
    brand_name: ['Apple', 'Nike', '华为', '小米', '阿迪达斯', '优衣库', '戴森', '雀巢'],
    product_name: ['iPhone 16 Pro', 'MacBook Air M4', 'AirPods Pro 3', 'Nike Air Max 2025', '华为 Mate 70', '小米 15 Ultra'],
    sku_name: ['iPhone 16 Pro 256GB 黑色', 'MacBook Air M4 16+512', 'AirPods Pro 3 白色', 'Nike Air Max 黑白'],
    currency: ['CNY', 'USD', 'EUR', 'JPY', 'GBP'],

    // ── User ──
    user_name: ['张三', '李四', '王五', '赵六', '陈七', '刘八', '周九', '吴十'],
    gender: ['男', '女'],
    age_group: ['18-24', '25-34', '35-44', '45-54', '55+'],
    user_tier: ['高价值', '中价值', '低价值', '新用户', '流失用户'],
    member_level: ['普通会员', '银卡会员', '金卡会员', '铂金会员', '钻石会员'],
    lifecycle_stage: ['新用户', '活跃期', '成熟期', '沉默期', '流失期'],
    value_segment: ['高价值', '中价值', '低价值', '沉默用户'],
    value_tier: ['高价值', '中价值', '低价值', '负价值'],

    // ── Order / Payment ──
    order_status: ['已完成', '待支付', '已发货', '已取消', '退款中'],
    payment_method: ['支付宝', '微信支付', '银行卡', '信用卡', 'Apple Pay'],
    payment_status: ['success', 'pending', 'failed', 'refunded'],
    refund_status: ['pending', 'approved', 'completed', 'rejected'],
    logistics_status: ['已发货', '运输中', '已签收', '退回中'],
    settle_cycle: ['T+0', 'T+1', 'T+7', 'T+15'],
    status: ['active', 'inactive', 'pending', 'completed', 'cancelled'],

    // ── Seller / Merchant ──
    seller_name: ['品质旗舰店', '品牌直营店', '优选好物馆', '海外精品馆', '工厂直销店'],
    merchant_name: ['品质旗舰店', '品牌直营店', '优选好物馆', '海外精品馆', '工厂直销店'],

    // ── Marketing / Behavior ──
    step_name: ['浏览商品', '加入购物车', '提交订单', '完成支付', '确认收货'],
    event_type: ['page_view', 'click', 'add_to_cart', 'purchase', 'search', 'share'],
    action: ['浏览', '点击', '收藏', '加购', '下单', '支付'],
    source: ['自然搜索', '付费推广', '社交分享', '直接访问', '邮件营销'],
    tag: ['高消费', '活跃用户', '新注册', '沉默用户', '品牌忠诚'],
    keyword: ['连衣裙', '手机壳', '运动鞋', '蓝牙耳机', '面膜', '零食大礼包', '机械键盘', '咖啡豆'],
    scene: ['搜索结果', '推荐位', '类目页', '促销活动', '详情页'],
    sentiment: ['positive', 'neutral', 'negative'],
    login_method: ['password', 'sms', 'wechat', 'fingerprint', 'face_id'],
    pay_method: ['alipay', 'wechat_pay', 'bank_card', 'balance'],

    // ── Risk / Compliance ──
    risk_type: ['欺诈交易', '账户盗用', '恶意刷单', '虚假注册', '异常登录'],
    risk_level: ['高风险', '中风险', '低风险'],
    risk_scene: ['payment', 'login', 'register', 'withdraw'],
    alert_level: ['P0', 'P1', 'P2', 'P3'],
    severity: ['critical', 'warning', 'info'],
    check_type: ['实名认证', 'KYC审核', '风控规则', '黑名单检查', '设备指纹'],
    list_type: ['blacklist', 'whitelist', 'graylist'],

    // ── Person roles ──
    operator: ['张运维', '李DBA', '王产品', '赵运营', '陈测试', '刘开发'],
    handler: ['张运维', '李DBA', '王产品', '赵运营', '陈测试'],
    auditor: ['审核员A', '审核员B', '审核员C', '审核员D'],
    owner: ['张三', '李四', '王五', '赵六'],
    receiver: ['张三', '李四', '王五', '赵六', '陈七'],

    // ── Time / Calendar ──
    cohort_date: ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22', '2026-02-01'],
    fiscal_year: ['FY2024', 'FY2025', 'FY2026'],
    fiscal_quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
    month: ['2026-01', '2026-02', '2026-03', '2026-04'],
    register_month: ['2026-01', '2026-02', '2026-03'],

    // ── ML / Data ──
    model_version: ['v1.0.0', 'v1.1.0', 'v2.0.0', 'v2.1.0', 'v3.0.0'],
    experiment_status: ['running', 'completed', 'stopped'],
    invite_code: ['INV001', 'INV002', 'INV003', 'INV004', 'INV005'],
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
