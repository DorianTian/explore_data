# Seed Expand: 290 → 2000 Physical Tables (Production-Only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone script that expands the production database from 290 to 2000 tables with physical PostgreSQL tables and realistic sample data.

**Architecture:** A single `seed-expand.ts` script that programmatically generates table definitions from a domain×area×layer matrix, inserts metadata via Drizzle ORM, then creates physical PG tables and sample rows via raw SQL. Reuses value generation logic from `physical-tables.ts`.

**Tech Stack:** TypeScript, tsx, Drizzle ORM, pg Pool, existing seed infrastructure

---

## File Structure

```
packages/api/src/seed/
├── seed-expand.ts          ← NEW: main script (orchestrator)
├── expand/
│   ├── table-registry.ts   ← NEW: domain×area×layer matrix → TableDef[]
│   ├── column-templates.ts ← NEW: layer-based column templates
│   ├── value-pools.ts      ← NEW: enriched Chinese business data pools
│   └── engine-config.ts    ← NEW: per-engine layer distribution weights
├── engines/types.ts         (read-only: TableDef, ColumnDef types)
├── physical-tables.ts       (read-only: toPgType, generateValue, DDL logic)
```

Each file has one job:
- `engine-config.ts`: maps each engine to its pgSchema, layer weights, target count
- `value-pools.ts`: large pools of realistic Chinese business data (cities, products, brands, etc.)
- `column-templates.ts`: given a layer + domain + area, returns a realistic `ColumnDef[]`
- `table-registry.ts`: combines all the above into a `generateExpandTables()` function
- `seed-expand.ts`: connects to DB, reads existing state, calls the generator, writes everything

---

### Task 1: Engine Config

**Files:**
- Create: `packages/api/src/seed/expand/engine-config.ts`

- [ ] **Step 1: Create engine config with layer distribution weights**

```ts
// packages/api/src/seed/expand/engine-config.ts
import type { TableDef } from '../engines/types.js';

export interface EngineExpandConfig {
  engineType: string;
  pgSchema: string;
  targetTotal: number;
  /** Layer distribution weights (must sum to 1.0) */
  layerWeights: Record<string, number>;
}

export const ENGINE_CONFIGS: EngineExpandConfig[] = [
  {
    engineType: 'mysql',
    pgSchema: 'dw_mysql',
    targetTotal: 400,
    layerWeights: { ods: 0.40, dim: 0.25, dwd: 0.20, dws: 0.15 },
  },
  {
    engineType: 'hive',
    pgSchema: 'dw_hive',
    targetTotal: 400,
    layerWeights: { dwd: 0.30, dws: 0.30, dim: 0.15, ads: 0.25 },
  },
  {
    engineType: 'doris',
    pgSchema: 'dw_doris',
    targetTotal: 400,
    layerWeights: { ads: 0.35, dws: 0.30, dwd: 0.20, dim: 0.15 },
  },
  {
    engineType: 'iceberg',
    pgSchema: 'dw_iceberg',
    targetTotal: 400,
    layerWeights: { dwd: 0.35, dws: 0.25, dim: 0.20, ads: 0.20 },
  },
  {
    engineType: 'spark',
    pgSchema: 'dw_spark',
    targetTotal: 400,
    layerWeights: { dws: 0.30, ads: 0.30, dwd: 0.25, dim: 0.15 },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/expand/engine-config.ts
git commit -m "feat(seed): add engine expand config with layer distribution weights"
```

---

### Task 2: Value Pools — Enriched Chinese Business Data

**Files:**
- Create: `packages/api/src/seed/expand/value-pools.ts`

- [ ] **Step 1: Create enriched value pools with real Chinese data**

This file contains large arrays of realistic Chinese business data. Key pools to include:

```ts
// packages/api/src/seed/expand/value-pools.ts

/** 340+ Chinese cities with tiers */
export const CITIES: Array<{ name: string; province: string; tier: string }> = [
  { name: '北京', province: '北京市', tier: '一线' },
  { name: '上海', province: '上海市', tier: '一线' },
  { name: '广州', province: '广东省', tier: '一线' },
  { name: '深圳', province: '广东省', tier: '一线' },
  // ... (expand to 100+ cities, organized by tier: 一线/新一线/二线/三线)
];

/** All 31 provinces + SARs */
export const PROVINCES: string[] = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
  '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省',
  '浙江省', '安徽省', '福建省', '江西省', '山东省',
  '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区',
  '海南省', '重庆市', '四川省', '贵州省', '云南省',
  '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区',
  '新疆维吾尔自治区',
];

/** Product categories — 3 levels (L1 → L2 → L3) */
export const CATEGORIES: Array<{ l1: string; l2: string; l3: string }> = [
  { l1: '电子产品', l2: '手机通讯', l3: '智能手机' },
  { l1: '电子产品', l2: '手机通讯', l3: '手机配件' },
  { l1: '电子产品', l2: '电脑办公', l3: '笔记本电脑' },
  // ... (expand to 150+ categories across 8 L1 categories)
];

/** Brand names by category */
export const BRANDS: Record<string, string[]> = {
  '电子产品': ['Apple', '华为', '小米', 'OPPO', 'vivo', '三星', '联想', '戴尔', 'ThinkPad', '荣耀'],
  '服装鞋帽': ['Nike', '阿迪达斯', '优衣库', 'ZARA', 'H&M', '李宁', '安踏', '波司登', '海澜之家', '太平鸟'],
  '食品饮料': ['蒙牛', '伊利', '农夫山泉', '元气森林', '三只松鼠', '百草味', '良品铺子', '雀巢', '可口可乐', '百事'],
  '家居用品': ['宜家', '无印良品', '网易严选', '小米有品', '戴森', '美的', '格力', '海尔', '科沃斯', '石头'],
  '美妆个护': ['兰蔻', '雅诗兰黛', '欧莱雅', '完美日记', '花西子', 'SK-II', '资生堂', '珀莱雅', '薇诺娜', '百雀羚'],
  '母婴用品': ['好孩子', 'Babycare', '全棉时代', '帮宝适', '飞鹤', '爱他美', '贝亲', '花王', 'a2', '美赞臣'],
  '运动户外': ['Nike', '阿迪达斯', '李宁', '安踏', 'Under Armour', 'The North Face', '迪卡侬', 'New Balance', '匹克', '特步'],
  '图书文娱': ['人民文学', '中信', '机械工业', '电子工业', '清华大学', '当当自营', '京东自营', '得到', '樊登', '喜马拉雅'],
};

/** Realistic product name templates */
export const PRODUCT_NAMES: string[] = [
  'iPhone 16 Pro Max 256GB', 'MacBook Air M4 16GB',
  'AirPods Pro 3', 'iPad Air M3 11英寸',
  '华为 Mate 70 Pro', '小米 15 Ultra 16+512',
  // ... (expand to 200+ realistic product names)
];

/** Chinese person names (surname pool + given name pool) */
export const SURNAMES: string[] = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗'];
export const GIVEN_NAMES: string[] = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];

/** Logistics companies */
export const LOGISTICS: string[] = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '京东物流', '极兔速递', '百世快递', '邮政EMS', '德邦快递'];

/** Payment methods */
export const PAYMENT_METHODS: string[] = ['支付宝', '微信支付', '银联云闪付', '工商银行', '建设银行', '招商银行', '信用卡', 'Apple Pay', '华为支付', '京东支付'];

/** Industry classifications (A股) */
export const INDUSTRIES: string[] = [
  '银行', '证券', '保险', '房地产', '医药生物', '电子', '计算机', '通信',
  '传媒', '机械设备', '化工', '食品饮料', '家用电器', '汽车', '电力设备',
  '建筑材料', '有色金属', '钢铁', '纺织服饰', '农林牧渔',
];

/** Marketing channels */
export const MARKETING_CHANNELS: string[] = [
  '自然搜索', '百度SEM', '抖音信息流', '小红书种草', '微信朋友圈广告',
  '淘宝直通车', 'KOL推广', '品牌联名', '线下地推', '邮件营销',
  'SMS短信', 'APP Push', '公众号文章', '视频号直播', '社群裂变',
];

/** Coupon types */
export const COUPON_TYPES: string[] = ['满减券', '折扣券', '免邮券', '新人券', '品类券', '店铺券', '跨店满减', '限时秒杀券'];

/** Warehouse locations */
export const WAREHOUSES: string[] = [
  '华东仓-上海', '华南仓-广州', '华北仓-北京', '华中仓-武汉',
  '西南仓-成都', '东北仓-沈阳', '西北仓-西安', '华东仓-杭州',
  '华南仓-深圳', '华北仓-天津',
];

/** Helper: pick random item from pool */
export function pick<T>(pool: T[], index: number): T {
  return pool[index % pool.length];
}

/** Helper: generate Chinese full name */
export function chineseName(index: number): string {
  return pick(SURNAMES, index) + pick(GIVEN_NAMES, index * 7 + 3);
}
```

The file should contain at minimum:
- 100+ cities with province and tier
- 150+ product categories (3-level hierarchy)
- 8 brand pools (one per L1 category, 10+ brands each)
- 200+ product names
- 20 surnames + 20 given names
- All pools listed above (logistics, payment, industries, marketing, coupons, warehouses)

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/expand/value-pools.ts
git commit -m "feat(seed): add enriched Chinese business data value pools"
```

---

### Task 3: Column Templates

**Files:**
- Create: `packages/api/src/seed/expand/column-templates.ts`

- [ ] **Step 1: Create layer-based column template generator**

This file defines how to generate realistic columns for each layer+domain+area combination:

```ts
// packages/api/src/seed/expand/column-templates.ts
import type { ColumnDef } from '../engines/types.js';

type Layer = 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
type Domain = 'trade' | 'user' | 'product' | 'risk';

/** Column builder shortcuts — same style as engine files */
const c = {
  pk: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'BIGINT', comment, isPrimaryKey: true }),
  bigint: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'BIGINT', comment }),
  int: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'INT', comment }),
  varchar: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'VARCHAR(255)', comment, ...opts }),
  decimal: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DECIMAL(18,2)', comment }),
  double: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DOUBLE', comment }),
  datetime: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DATETIME', comment }),
  date: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DATE', comment }),
  text: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'TEXT', comment }),
  bool: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'BOOLEAN', comment }),
  timestamp: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'TIMESTAMP', comment }),
};

/**
 * Base columns shared across layers.
 * Each layer template adds domain/area-specific columns on top of these.
 */
const baseOds = (area: string): ColumnDef[] => [
  c.pk('id', `${area}记录ID`),
  c.varchar('source_system', '来源系统'),
  c.datetime('created_at', '创建时间'),
  c.datetime('updated_at', '更新时间'),
  c.date('ds', '数据分区日期'),
];

const baseDwd = (area: string): ColumnDef[] => [
  c.pk('id', `${area}明细ID`),
  c.datetime('etl_time', 'ETL处理时间'),
  c.date('ds', '数据分区日期'),
];

const baseDws = (area: string, metric: string): ColumnDef[] => [
  c.pk('id', `${area}汇总ID`),
  c.date('stat_date', '统计日期'),
];

const baseDim = (entity: string): ColumnDef[] => [
  c.pk('id', `${entity}ID`),
  c.varchar('code', `${entity}编码`),
  c.varchar('name', `${entity}名称`),
  c.varchar('status', '状态', { sampleValues: ['active', 'inactive'] }),
  c.datetime('valid_from', '生效时间'),
  c.datetime('valid_to', '失效时间'),
];

const baseAds = (report: string): ColumnDef[] => [
  c.pk('id', `${report}报表ID`),
  c.date('stat_date', '统计日期'),
  c.varchar('period_type', '周期类型', { sampleValues: ['daily', 'weekly', 'monthly'] }),
];

/**
 * Domain-specific extra columns — added based on domain+area combination.
 * Returns 3-8 additional columns to make each table unique and realistic.
 */
const DOMAIN_COLUMNS: Record<Domain, Record<string, () => ColumnDef[]>> = {
  trade: {
    order: () => [
      c.varchar('order_no', '订单编号'), c.bigint('user_id', '用户ID'),
      c.decimal('total_amount', '总金额'), c.decimal('actual_amount', '实付金额'),
      c.varchar('order_status', '订单状态', { sampleValues: ['pending', 'paid', 'shipped', 'completed', 'cancelled'] }),
      c.varchar('channel', '下单渠道', { sampleValues: ['app', 'h5', 'mini_program', 'web'] }),
    ],
    payment: () => [
      c.varchar('payment_no', '支付流水号'), c.bigint('order_id', '订单ID'),
      c.decimal('payment_amount', '支付金额'),
      c.varchar('payment_method', '支付方式', { sampleValues: ['alipay', 'wechat', 'bank_card'] }),
      c.varchar('payment_status', '支付状态', { sampleValues: ['success', 'pending', 'failed'] }),
    ],
    refund: () => [
      c.varchar('refund_no', '退款编号'), c.bigint('order_id', '原订单ID'),
      c.decimal('refund_amount', '退款金额'),
      c.varchar('refund_reason', '退款原因'), c.varchar('refund_status', '退款状态'),
    ],
    logistics: () => [
      c.varchar('tracking_no', '物流单号'), c.bigint('order_id', '订单ID'),
      c.varchar('carrier', '物流公司'), c.varchar('logistics_status', '物流状态'),
      c.varchar('sender_city', '发货城市'), c.varchar('receiver_city', '收货城市'),
    ],
    settlement: () => [
      c.varchar('settle_no', '结算单号'), c.bigint('merchant_id', '商家ID'),
      c.decimal('settle_amount', '结算金额'), c.decimal('commission_amount', '佣金金额'),
      c.varchar('settle_status', '结算状态'), c.varchar('settle_cycle', '结算周期'),
    ],
    invoice: () => [
      c.varchar('invoice_no', '发票号'), c.bigint('order_id', '订单ID'),
      c.decimal('invoice_amount', '开票金额'), c.varchar('invoice_type', '发票类型'),
      c.varchar('buyer_name', '购方名称'), c.varchar('tax_no', '税号'),
    ],
    contract: () => [
      c.varchar('contract_no', '合同编号'), c.bigint('merchant_id', '商家ID'),
      c.decimal('contract_amount', '合同金额'), c.varchar('contract_type', '合同类型'),
      c.date('start_date', '生效日期'), c.date('end_date', '到期日期'),
    ],
    commission: () => [
      c.bigint('merchant_id', '商家ID'), c.bigint('order_id', '订单ID'),
      c.decimal('commission_rate', '佣金比例'), c.decimal('commission_amount', '佣金金额'),
      c.varchar('commission_type', '佣金类型'),
    ],
    subscription: () => [
      c.bigint('user_id', '用户ID'), c.varchar('plan_name', '套餐名称'),
      c.decimal('price', '价格'), c.varchar('billing_cycle', '计费周期'),
      c.varchar('sub_status', '订阅状态'), c.datetime('next_billing_date', '下次扣费时间'),
    ],
    coupon_usage: () => [
      c.bigint('coupon_id', '优惠券ID'), c.bigint('user_id', '用户ID'),
      c.bigint('order_id', '订单ID'), c.decimal('discount_amount', '优惠金额'),
      c.varchar('coupon_type', '券类型'), c.datetime('used_time', '使用时间'),
    ],
    flash_sale: () => [
      c.bigint('product_id', '商品ID'), c.decimal('flash_price', '秒杀价'),
      c.decimal('original_price', '原价'), c.int('stock_limit', '限量库存'),
      c.int('sold_count', '已售数量'), c.datetime('start_time', '开始时间'),
    ],
    group_buy: () => [
      c.bigint('product_id', '商品ID'), c.int('group_size', '成团人数'),
      c.decimal('group_price', '拼团价'), c.varchar('group_status', '拼团状态'),
      c.int('current_count', '当前人数'), c.datetime('expire_time', '过期时间'),
    ],
    pre_sale: () => [
      c.bigint('product_id', '商品ID'), c.decimal('deposit_amount', '定金金额'),
      c.decimal('final_amount', '尾款金额'), c.datetime('pay_deadline', '尾款截止时间'),
      c.varchar('pre_sale_status', '预售状态'), c.int('pre_order_count', '预订数量'),
    ],
    cross_border: () => [
      c.varchar('customs_no', '报关单号'), c.bigint('order_id', '订单ID'),
      c.varchar('origin_country', '原产国'), c.decimal('tax_amount', '税费金额'),
      c.varchar('customs_status', '通关状态'), c.varchar('warehouse', '保税仓'),
    ],
    after_sale: () => [
      c.varchar('service_no', '售后单号'), c.bigint('order_id', '订单ID'),
      c.varchar('service_type', '售后类型', { sampleValues: ['退货', '换货', '维修'] }),
      c.varchar('service_status', '处理状态'), c.text('description', '问题描述'),
    ],
    dispute: () => [
      c.varchar('dispute_no', '纠纷编号'), c.bigint('order_id', '订单ID'),
      c.varchar('dispute_type', '纠纷类型'), c.varchar('dispute_status', '处理状态'),
      c.varchar('handler', '处理人'), c.text('resolution', '处理结果'),
    ],
    evaluation: () => [
      c.bigint('order_id', '订单ID'), c.bigint('product_id', '商品ID'),
      c.int('score', '评分'), c.text('content', '评价内容'),
      c.int('image_count', '图片数量'), c.bool('is_anonymous', '是否匿名'),
    ],
    cart: () => [
      c.bigint('user_id', '用户ID'), c.bigint('product_id', '商品ID'),
      c.bigint('sku_id', 'SKU ID'), c.int('quantity', '数量'),
      c.decimal('unit_price', '单价'), c.bool('is_selected', '是否选中'),
    ],
    checkout: () => [
      c.bigint('user_id', '用户ID'), c.varchar('checkout_token', '结算令牌'),
      c.int('item_count', '商品数量'), c.decimal('total_amount', '总金额'),
      c.varchar('address_id', '收货地址ID'), c.varchar('checkout_status', '结算状态'),
    ],
    delivery_fee: () => [
      c.bigint('order_id', '订单ID'), c.decimal('base_fee', '基础运费'),
      c.decimal('weight_fee', '重量附加费'), c.decimal('distance_fee', '距离附加费'),
      c.decimal('total_fee', '总运费'), c.bool('is_free', '是否包邮'),
    ],
  },
  user: {
    register: () => [
      c.varchar('username', '用户名'), c.varchar('email', '邮箱'),
      c.varchar('phone', '手机号', { isPii: true }), c.varchar('register_source', '注册来源'),
      c.varchar('register_ip', '注册IP'), c.varchar('gender', '性别'),
    ],
    profile: () => [
      c.bigint('user_id', '用户ID'), c.varchar('nickname', '昵称'),
      c.varchar('avatar_url', '头像URL'), c.date('birthday', '生日'),
      c.varchar('bio', '个人简介'), c.varchar('city', '所在城市'),
    ],
    login: () => [
      c.bigint('user_id', '用户ID'), c.datetime('login_time', '登录时间'),
      c.varchar('login_ip', '登录IP'), c.varchar('device_type', '设备类型'),
      c.varchar('login_method', '登录方式'), c.bool('is_success', '是否成功'),
    ],
    session: () => [
      c.bigint('user_id', '用户ID'), c.varchar('session_id', '会话ID'),
      c.datetime('start_time', '开始时间'), c.datetime('end_time', '结束时间'),
      c.int('page_count', '浏览页数'), c.int('duration_sec', '停留秒数'),
    ],
    behavior: () => [
      c.bigint('user_id', '用户ID'), c.varchar('event_type', '事件类型'),
      c.varchar('page_name', '页面名称'), c.varchar('element_id', '元素ID'),
      c.text('event_params', '事件参数'), c.timestamp('event_time', '事件时间'),
    ],
    preference: () => [
      c.bigint('user_id', '用户ID'), c.varchar('preference_key', '偏好键'),
      c.varchar('preference_value', '偏好值'), c.varchar('category', '偏好类别'),
      c.double('weight', '权重'), c.datetime('last_updated', '最后更新'),
    ],
    feedback: () => [
      c.bigint('user_id', '用户ID'), c.varchar('feedback_type', '反馈类型'),
      c.text('content', '反馈内容'), c.int('rating', '评分'),
      c.varchar('status', '处理状态'), c.varchar('handler', '处理人'),
    ],
    notification: () => [
      c.bigint('user_id', '用户ID'), c.varchar('notif_type', '通知类型'),
      c.varchar('title', '标题'), c.text('content', '内容'),
      c.bool('is_read', '是否已读'), c.datetime('sent_at', '发送时间'),
    ],
    membership: () => [
      c.bigint('user_id', '用户ID'), c.varchar('member_level', '会员等级'),
      c.int('points', '积分'), c.date('expire_date', '到期日期'),
      c.decimal('total_spend', '累计消费'), c.int('order_count', '订单数'),
    ],
    address: () => [
      c.bigint('user_id', '用户ID'), c.varchar('receiver_name', '收件人'),
      c.varchar('phone', '手机号', { isPii: true }), c.varchar('province', '省'),
      c.varchar('city', '市'), c.text('detail_address', '详细地址'),
    ],
    device: () => [
      c.bigint('user_id', '用户ID'), c.varchar('device_id', '设备ID'),
      c.varchar('device_model', '设备型号'), c.varchar('os', '操作系统'),
      c.varchar('app_version', 'APP版本'), c.datetime('last_active', '最后活跃'),
    ],
    credit: () => [
      c.bigint('user_id', '用户ID'), c.int('credit_score', '信用分'),
      c.varchar('credit_level', '信用等级'), c.decimal('credit_limit', '信用额度'),
      c.int('overdue_count', '逾期次数'), c.datetime('last_evaluated', '最后评估时间'),
    ],
    identity: () => [
      c.bigint('user_id', '用户ID'), c.varchar('id_type', '证件类型'),
      c.varchar('id_number_hash', '证件号哈希'), c.varchar('real_name_hash', '姓名哈希'),
      c.bool('is_verified', '是否已认证'), c.datetime('verified_at', '认证时间'),
    ],
    social: () => [
      c.bigint('user_id', '用户ID'), c.bigint('friend_id', '好友ID'),
      c.varchar('relation_type', '关系类型'), c.datetime('connected_at', '建立时间'),
      c.varchar('source', '来源'), c.bool('is_mutual', '是否互关'),
    ],
    invite: () => [
      c.bigint('inviter_id', '邀请人ID'), c.bigint('invitee_id', '被邀请人ID'),
      c.varchar('invite_code', '邀请码'), c.varchar('invite_channel', '邀请渠道'),
      c.bool('is_converted', '是否转化'), c.decimal('reward_amount', '奖励金额'),
    ],
    growth_task: () => [
      c.bigint('user_id', '用户ID'), c.varchar('task_name', '任务名称'),
      c.varchar('task_type', '任务类型'), c.int('reward_points', '奖励积分'),
      c.bool('is_completed', '是否完成'), c.datetime('completed_at', '完成时间'),
    ],
    signin: () => [
      c.bigint('user_id', '用户ID'), c.date('signin_date', '签到日期'),
      c.int('consecutive_days', '连续天数'), c.int('reward_points', '奖励积分'),
      c.bool('is_makeup', '是否补签'),
    ],
    points: () => [
      c.bigint('user_id', '用户ID'), c.varchar('change_type', '变动类型'),
      c.int('points_change', '积分变动'), c.int('balance', '积分余额'),
      c.varchar('source', '来源'), c.text('remark', '备注'),
    ],
    wallet: () => [
      c.bigint('user_id', '用户ID'), c.varchar('txn_type', '交易类型'),
      c.decimal('amount', '金额'), c.decimal('balance', '余额'),
      c.varchar('channel', '渠道'), c.varchar('txn_status', '交易状态'),
    ],
    blacklist: () => [
      c.bigint('user_id', '用户ID'), c.varchar('reason', '拉黑原因'),
      c.varchar('operator', '操作人'), c.datetime('blocked_at', '拉黑时间'),
      c.datetime('unblock_at', '解除时间'), c.bool('is_active', '是否生效'),
    ],
  },
  product: {
    catalog: () => [
      c.varchar('product_name', '商品名称'), c.varchar('brand', '品牌'),
      c.varchar('category_l1', '一级类目'), c.varchar('category_l2', '二级类目'),
      c.decimal('price', '价格'), c.varchar('product_status', '商品状态'),
    ],
    sku: () => [
      c.bigint('product_id', '商品ID'), c.varchar('sku_code', 'SKU编码'),
      c.varchar('spec_name', '规格名'), c.varchar('spec_value', '规格值'),
      c.decimal('sku_price', 'SKU价格'), c.int('sku_stock', 'SKU库存'),
    ],
    inventory: () => [
      c.bigint('sku_id', 'SKU ID'), c.varchar('warehouse', '仓库'),
      c.int('available_qty', '可用库存'), c.int('locked_qty', '锁定库存'),
      c.int('total_qty', '总库存'), c.datetime('last_replenish', '最后补货时间'),
    ],
    pricing: () => [
      c.bigint('product_id', '商品ID'), c.decimal('cost_price', '成本价'),
      c.decimal('market_price', '市场价'), c.decimal('selling_price', '售价'),
      c.decimal('member_price', '会员价'), c.varchar('pricing_strategy', '定价策略'),
    ],
    promotion: () => [
      c.varchar('promo_name', '活动名称'), c.varchar('promo_type', '活动类型'),
      c.decimal('discount_rate', '折扣率'), c.datetime('start_time', '开始时间'),
      c.datetime('end_time', '结束时间'), c.int('participate_count', '参与人数'),
    ],
    review: () => [
      c.bigint('product_id', '商品ID'), c.bigint('user_id', '用户ID'),
      c.int('rating', '评分'), c.text('content', '评价内容'),
      c.int('like_count', '点赞数'), c.bool('has_image', '是否有图'),
    ],
    recommendation: () => [
      c.bigint('user_id', '用户ID'), c.bigint('product_id', '推荐商品ID'),
      c.varchar('rec_type', '推荐类型'), c.double('rec_score', '推荐分数'),
      c.varchar('rec_reason', '推荐理由'), c.int('position', '展示位置'),
    ],
    collection: () => [
      c.bigint('user_id', '用户ID'), c.bigint('product_id', '商品ID'),
      c.varchar('collection_name', '收藏夹名'), c.datetime('collected_at', '收藏时间'),
      c.bool('is_notify', '降价提醒'),
    ],
    tag: () => [
      c.bigint('product_id', '商品ID'), c.varchar('tag_name', '标签名'),
      c.varchar('tag_type', '标签类型'), c.double('confidence', '置信度'),
      c.varchar('source', '来源'),
    ],
    attribute: () => [
      c.bigint('product_id', '商品ID'), c.varchar('attr_name', '属性名'),
      c.varchar('attr_value', '属性值'), c.varchar('attr_group', '属性组'),
      c.int('sort_order', '排序'),
    ],
    warehouse: () => [
      c.varchar('warehouse_code', '仓库编码'), c.varchar('warehouse_name', '仓库名称'),
      c.varchar('city', '所在城市'), c.varchar('warehouse_type', '仓库类型'),
      c.int('capacity', '容量'), c.double('utilization_rate', '利用率'),
    ],
    supplier: () => [
      c.varchar('supplier_code', '供应商编码'), c.varchar('supplier_name', '供应商名称'),
      c.varchar('contact_name', '联系人'), c.varchar('contact_phone', '联系电话'),
      c.varchar('city', '所在城市'), c.varchar('cooperation_status', '合作状态'),
    ],
    quality: () => [
      c.bigint('product_id', '商品ID'), c.varchar('batch_no', '批次号'),
      c.varchar('check_type', '检测类型'), c.varchar('check_result', '检测结果'),
      c.double('pass_rate', '合格率'), c.varchar('inspector', '检测员'),
    ],
    lifecycle: () => [
      c.bigint('product_id', '商品ID'), c.varchar('lifecycle_stage', '生命周期阶段'),
      c.date('launch_date', '上市日期'), c.date('discontinue_date', '停售日期'),
      c.int('days_on_shelf', '在架天数'), c.decimal('total_sales', '累计销售额'),
    ],
    bundle: () => [
      c.varchar('bundle_name', '套装名称'), c.decimal('bundle_price', '套装价'),
      c.decimal('original_total', '原价合计'), c.int('item_count', '商品数量'),
      c.varchar('bundle_status', '套装状态'), c.double('save_rate', '节省比例'),
    ],
    comparison: () => [
      c.bigint('product_a_id', '商品A ID'), c.bigint('product_b_id', '商品B ID'),
      c.varchar('dimension', '对比维度'), c.varchar('winner', '优胜方'),
      c.int('view_count', '查看次数'),
    ],
    seo: () => [
      c.bigint('product_id', '商品ID'), c.varchar('meta_title', 'SEO标题'),
      c.varchar('meta_keywords', '关键词'), c.text('meta_description', '描述'),
      c.varchar('slug', 'URL标识'), c.int('search_rank', '搜索排名'),
    ],
    media: () => [
      c.bigint('product_id', '商品ID'), c.varchar('media_type', '媒体类型'),
      c.varchar('media_url', '媒体URL'), c.int('sort_order', '排序'),
      c.int('width', '宽度'), c.int('height', '高度'),
    ],
    variant: () => [
      c.bigint('product_id', '商品ID'), c.varchar('color', '颜色'),
      c.varchar('size', '尺码'), c.varchar('material', '材质'),
      c.decimal('price_diff', '价格差异'), c.int('stock', '库存'),
    ],
    stock_alert: () => [
      c.bigint('sku_id', 'SKU ID'), c.varchar('alert_type', '预警类型'),
      c.int('threshold', '阈值'), c.int('current_stock', '当前库存'),
      c.bool('is_triggered', '是否触发'), c.datetime('triggered_at', '触发时间'),
    ],
  },
  risk: {
    fraud_detect: () => [
      c.bigint('user_id', '用户ID'), c.varchar('fraud_type', '欺诈类型'),
      c.double('risk_score', '风险分'), c.varchar('risk_level', '风险等级'),
      c.varchar('action_taken', '处置动作'), c.text('evidence', '证据摘要'),
    ],
    audit_log: () => [
      c.varchar('operator', '操作人'), c.varchar('action', '操作类型'),
      c.varchar('resource_type', '资源类型'), c.varchar('resource_id', '资源ID'),
      c.text('old_value', '旧值'), c.text('new_value', '新值'),
    ],
    compliance: () => [
      c.varchar('rule_code', '规则编码'), c.varchar('check_target', '检查对象'),
      c.varchar('check_result', '检查结果'), c.varchar('violation_type', '违规类型'),
      c.text('detail', '详情'), c.varchar('remediation_status', '整改状态'),
    ],
    monitor: () => [
      c.varchar('monitor_name', '监控名称'), c.varchar('metric_name', '指标名称'),
      c.double('current_value', '当前值'), c.double('threshold_value', '阈值'),
      c.varchar('alert_status', '告警状态'), c.varchar('severity', '严重程度'),
    ],
    alert: () => [
      c.varchar('alert_id', '告警ID'), c.varchar('alert_type', '告警类型'),
      c.varchar('severity', '严重等级'), c.varchar('source', '来源'),
      c.text('message', '告警信息'), c.varchar('status', '处理状态'),
    ],
    rule_engine: () => [
      c.varchar('rule_name', '规则名称'), c.varchar('rule_type', '规则类型'),
      c.text('condition_expr', '条件表达式'), c.varchar('action_type', '动作类型'),
      c.int('priority', '优先级'), c.bool('is_enabled', '是否启用'),
    ],
    blocklist: () => [
      c.varchar('list_type', '名单类型'), c.varchar('target_type', '目标类型'),
      c.varchar('target_value', '目标值'), c.varchar('reason', '原因'),
      c.datetime('expire_at', '过期时间'), c.varchar('operator', '操作人'),
    ],
    verification: () => [
      c.bigint('user_id', '用户ID'), c.varchar('verify_type', '验证类型'),
      c.varchar('verify_status', '验证状态'), c.int('attempt_count', '尝试次数'),
      c.varchar('channel', '验证渠道'), c.datetime('verified_at', '验证时间'),
    ],
    credit_score: () => [
      c.bigint('user_id', '用户ID'), c.int('score', '信用分'),
      c.varchar('score_level', '信用等级'), c.int('score_change', '分数变动'),
      c.varchar('change_reason', '变动原因'), c.date('evaluation_date', '评估日期'),
    ],
    anti_spam: () => [
      c.bigint('user_id', '用户ID'), c.varchar('content_type', '内容类型'),
      c.text('content_hash', '内容哈希'), c.double('spam_score', '垃圾分数'),
      c.varchar('detection_result', '检测结果'), c.varchar('model_version', '模型版本'),
    ],
    device_fingerprint: () => [
      c.varchar('fingerprint_id', '指纹ID'), c.bigint('user_id', '关联用户ID'),
      c.varchar('device_type', '设备类型'), c.varchar('browser_ua', '浏览器UA'),
      c.varchar('screen_resolution', '屏幕分辨率'), c.int('risk_hits', '命中风控次数'),
    ],
    ip_risk: () => [
      c.varchar('ip_address', 'IP地址'), c.varchar('risk_level', '风险等级'),
      c.varchar('geo_location', '地理位置'), c.varchar('isp', '运营商'),
      c.int('request_count_1h', '1小时请求数'), c.bool('is_proxy', '是否代理'),
    ],
    transaction_risk: () => [
      c.bigint('order_id', '订单ID'), c.double('risk_score', '风险评分'),
      c.varchar('risk_factors', '风险因子'), c.varchar('decision', '决策结果'),
      c.int('model_latency_ms', '模型延迟ms'), c.varchar('model_version', '模型版本'),
    ],
    account_security: () => [
      c.bigint('user_id', '用户ID'), c.varchar('event_type', '事件类型'),
      c.varchar('ip_address', 'IP地址'), c.varchar('device_id', '设备ID'),
      c.bool('is_anomaly', '是否异常'), c.varchar('action_taken', '处置动作'),
    ],
    data_quality: () => [
      c.varchar('table_name', '表名'), c.varchar('rule_name', '规则名'),
      c.varchar('check_type', '检查类型'), c.bigint('total_rows', '总行数'),
      c.bigint('failed_rows', '失败行数'), c.double('pass_rate', '通过率'),
    ],
  },
};

/**
 * Generate columns for a specific table based on layer, domain, and area.
 */
export function generateColumns(layer: Layer, domain: Domain, area: string): ColumnDef[] {
  const domainCols = DOMAIN_COLUMNS[domain]?.[area];
  const extraCols = domainCols ? domainCols() : [
    c.varchar('name', '名称'),
    c.varchar('type', '类型'),
    c.varchar('status', '状态'),
    c.text('remark', '备注'),
  ];

  switch (layer) {
    case 'ods': return [...baseOds(area), ...extraCols];
    case 'dwd': return [...baseDwd(area), ...extraCols];
    case 'dws': return [...baseDws(area, 'summary'), ...extraCols.slice(0, 3),
      c.bigint('total_count', '总数量'), c.decimal('total_amount', '总金额'),
      c.double('avg_value', '平均值'), c.double('rate', '比率')];
    case 'dim': return [...baseDim(area), ...extraCols.slice(0, 3)];
    case 'ads': return [...baseAds(area), ...extraCols.slice(0, 3),
      c.decimal('kpi_value', 'KPI值'), c.double('rate_pct', '占比'),
      c.double('mom_change', '环比变化'), c.double('yoy_change', '同比变化')];
    default: return [...baseOds(area), ...extraCols];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/expand/column-templates.ts
git commit -m "feat(seed): add layer-based column template generator for expand"
```

---

### Task 4: Table Registry — Combinatorial Table Generator

**Files:**
- Create: `packages/api/src/seed/expand/table-registry.ts`

- [ ] **Step 1: Create the table registry that generates TableDef arrays**

```ts
// packages/api/src/seed/expand/table-registry.ts
import type { TableDef } from '../engines/types.js';
import type { EngineExpandConfig } from './engine-config.js';
import { generateColumns } from './column-templates.js';

type Layer = 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
type Domain = 'trade' | 'user' | 'product' | 'risk';

/** All business areas per domain */
const DOMAIN_AREAS: Record<Domain, string[]> = {
  trade: [
    'order', 'payment', 'refund', 'logistics', 'settlement', 'invoice',
    'contract', 'commission', 'subscription', 'coupon_usage', 'flash_sale',
    'group_buy', 'pre_sale', 'cross_border', 'after_sale', 'dispute',
    'evaluation', 'cart', 'checkout', 'delivery_fee',
  ],
  user: [
    'register', 'profile', 'login', 'session', 'behavior', 'preference',
    'feedback', 'notification', 'membership', 'address', 'device', 'credit',
    'identity', 'social', 'invite', 'growth_task', 'signin', 'points',
    'wallet', 'blacklist',
  ],
  product: [
    'catalog', 'sku', 'inventory', 'pricing', 'promotion', 'review',
    'recommendation', 'collection', 'tag', 'attribute', 'warehouse',
    'supplier', 'quality', 'lifecycle', 'bundle', 'comparison', 'seo',
    'media', 'variant', 'stock_alert',
  ],
  risk: [
    'fraud_detect', 'audit_log', 'compliance', 'monitor', 'alert',
    'rule_engine', 'blocklist', 'verification', 'credit_score', 'anti_spam',
    'device_fingerprint', 'ip_risk', 'transaction_risk', 'account_security',
    'data_quality',
  ],
};

/** Layer → table name suffix variants (for DWS/ADS period variations) */
const LAYER_SUFFIXES: Record<string, string[]> = {
  ods: ['_df', '_di'],
  dwd: ['_detail_di', '_detail_df'],
  dws: ['_1d', '_7d', '_30d'],
  dim: [''],
  ads: ['_1d', '_7d', '_30d'],
};

/** Generate table name from components */
function tableName(layer: Layer, domain: Domain, area: string, suffix: string): string {
  if (layer === 'dim') return `dim_${area}${suffix}`;
  return `${layer}_${domain}_${area}${suffix}`;
}

/** Generate table comment */
function tableComment(layer: Layer, domain: Domain, area: string, suffix: string): string {
  const layerLabel: Record<string, string> = {
    ods: '原始数据', dwd: '明细事实', dws: '汇总统计', dim: '维度', ads: '应用报表',
  };
  const periodLabel: Record<string, string> = {
    '_1d': '日', '_7d': '周', '_30d': '月', '_df': '日全量', '_di': '日增量',
    '_detail_di': '明细增量', '_detail_df': '明细全量', '': '',
  };
  const areaLabel = area.replace(/_/g, ' ');
  return `${areaLabel}${layerLabel[layer]}表${periodLabel[suffix] ? `-${periodLabel[suffix]}` : ''}`;
}

/**
 * Generate expand table definitions for one engine.
 * Skips table names that already exist (existingNames set).
 */
export function generateExpandTables(
  config: EngineExpandConfig,
  existingCount: number,
  existingNames: Set<string>,
): TableDef[] {
  const needed = config.targetTotal - existingCount;
  if (needed <= 0) return [];

  const tables: TableDef[] = [];
  const layers = Object.entries(config.layerWeights) as [Layer, number][];
  const domains: Domain[] = ['trade', 'user', 'product', 'risk'];

  // Calculate how many tables each layer needs
  const layerTargets = new Map<Layer, number>();
  for (const [layer, weight] of layers) {
    layerTargets.set(layer, Math.round(needed * weight));
  }

  // Generate tables by iterating domain × area × layer × suffix
  for (const [layer, target] of layerTargets) {
    let count = 0;
    const suffixes = LAYER_SUFFIXES[layer] ?? [''];

    for (const domain of domains) {
      const areas = DOMAIN_AREAS[domain];
      for (const area of areas) {
        for (const suffix of suffixes) {
          if (count >= target) break;

          const name = tableName(layer, domain, area, suffix);
          if (existingNames.has(name)) continue;

          tables.push({
            name,
            comment: tableComment(layer, domain, area, suffix),
            layer,
            domain,
            columns: generateColumns(layer, domain, area),
          });
          count++;
        }
        if (count >= target) break;
      }
      if (count >= target) break;
    }
  }

  return tables;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/seed/expand/table-registry.ts
git commit -m "feat(seed): add combinatorial table registry for expand generation"
```

---

### Task 5: Main Script — seed-expand.ts

**Files:**
- Create: `packages/api/src/seed/seed-expand.ts`

- [ ] **Step 1: Create the main seed-expand orchestrator script**

```ts
// packages/api/src/seed/seed-expand.ts
/**
 * Production-only seed expansion: 290 → 2000 tables.
 * Reads existing datasources, generates additional tables, creates physical PG tables + sample data.
 *
 * Usage: DATABASE_URL=<prod_url> npx tsx packages/api/src/seed/seed-expand.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

import { eq } from 'drizzle-orm';
import pg from 'pg';
import { createDbClient } from '@nl2sql/db';
import { datasources, schemaTables, schemaColumns } from '@nl2sql/db';
import { ENGINE_CONFIGS } from './expand/engine-config.js';
import { generateExpandTables } from './expand/table-registry.js';
import type { TableDef, ColumnDef } from './engines/types.js';

/* ── Physical table helpers (adapted from physical-tables.ts) ── */

const PG_TYPE_MAP: Record<string, string> = {
  BIGINT: 'BIGINT', INT: 'INTEGER', INTEGER: 'INTEGER', SMALLINT: 'SMALLINT',
  TINYINT: 'SMALLINT', STRING: 'TEXT', 'VARCHAR(255)': 'VARCHAR(255)', TEXT: 'TEXT',
  'DECIMAL(18,2)': 'NUMERIC(18,2)', DOUBLE: 'DOUBLE PRECISION', FLOAT: 'REAL',
  BOOLEAN: 'BOOLEAN', DATE: 'DATE', TIMESTAMP: 'TIMESTAMP', DATETIME: 'TIMESTAMP',
  JSON: 'JSONB', JSONB: 'JSONB', ENUM: 'VARCHAR(50)',
};

function toPgType(seedType: string): string {
  const upper = seedType.toUpperCase();
  if (PG_TYPE_MAP[upper]) return PG_TYPE_MAP[upper];
  const m = upper.match(/^VARCHAR\((\d+)\)$/);
  if (m) return `VARCHAR(${m[1]})`;
  const d = upper.match(/^DECIMAL\((\d+),(\d+)\)$/);
  if (d) return `NUMERIC(${d[1]},${d[2]})`;
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

/* ── Sample data generation (adapted from physical-tables.ts) ── */

function generateValue(col: ColumnDef, index: number, domain: string): unknown {
  const upper = col.dataType.toUpperCase();

  if (col.sampleValues?.length) return col.sampleValues[index % col.sampleValues.length];
  if (col.isPrimaryKey) return index + 1;
  if (col.name.endsWith('_id') || col.referencesTable) return (index % 50) + 1;
  if (col.name === 'ds') {
    const base = new Date('2026-01-04');
    const d = new Date(base.getTime() + Math.floor((index / 100) * 90) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (['DATETIME', 'TIMESTAMP'].includes(upper)) {
    const base = new Date('2026-01-04T00:00:00Z');
    const offset = Math.floor((index / 100) * 90 * 86400000) + Math.floor(Math.random() * 86400000);
    return new Date(base.getTime() + offset).toISOString().replace('T', ' ').slice(0, 19);
  }
  if (upper === 'DATE') {
    const base = new Date('2026-01-04');
    const d = new Date(base.getTime() + Math.floor((index / 100) * 90) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (['BIGINT', 'INT', 'INTEGER', 'SMALLINT', 'TINYINT'].includes(upper)) {
    if (col.name.includes('count') || col.name.includes('num')) return Math.floor(Math.random() * 500) + 1;
    if (col.name.includes('score')) return Math.floor(Math.random() * 100) + 1;
    return Math.floor(Math.random() * 10000) + 1;
  }
  if (['DECIMAL(18,2)', 'DOUBLE', 'FLOAT'].includes(upper)) {
    if (col.name.includes('rate') || col.name.includes('ratio') || col.name.includes('pct')) return Number((Math.random() * 100).toFixed(2));
    if (col.name.includes('amount') || col.name.includes('price') || col.name.includes('fee')) return Number((Math.random() * 5000 + 10).toFixed(2));
    return Number((Math.random() * 1000).toFixed(2));
  }
  if (upper === 'BOOLEAN') return Math.random() > 0.3;
  if (col.name.includes('name') || col.name.includes('title')) return `${col.comment?.slice(0, 4) ?? col.name}_${index + 1}`;
  if (col.name.includes('phone') || col.name.includes('mobile')) return `138${String(10000000 + index).slice(-8)}`;
  if (col.name.includes('email')) return `user${index + 1}@example.com`;
  if (col.name.includes('url') || col.name.includes('link')) return `https://cdn.example.com/${col.name}/${index + 1}.png`;
  if (col.name.includes('content') || col.name.includes('detail') || col.name.includes('remark')) {
    const texts = ['商品质量很好', '性价比不错', '物流很快', '包装完整', '客服态度好', '推荐购买', '使用体验一般', '做工精细'];
    return texts[index % texts.length];
  }
  if (col.name.endsWith('_no') || col.name.endsWith('_code')) {
    const prefix = col.name.replace(/_(no|code)$/, '').toUpperCase().slice(0, 3);
    return `${prefix}${String(index + 1).padStart(12, '0')}`;
  }
  if (col.comment) return `${col.comment.slice(0, 6)}_${index + 1}`;
  return `${col.name}_${index + 1}`;
}

async function insertSampleRows(pool: pg.Pool, pgSchema: string, table: TableDef, rowCount: number): Promise<number> {
  const columns = table.columns.map((col) => `"${col.name}"`);
  const batchSize = 25;
  let inserted = 0;

  for (let batch = 0; batch < rowCount; batch += batchSize) {
    const chunkSize = Math.min(batchSize, rowCount - batch);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let ri = 0; ri < chunkSize; ri++) {
      const index = batch + ri;
      const rowPlaceholders = columns.map((_, ci) => `$${ri * columns.length + ci + 1}`);
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
      for (const col of table.columns) {
        values.push(generateValue(col, index, table.domain));
      }
    }

    await pool.query(
      `INSERT INTO "${pgSchema}"."${table.name}" (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values,
    );
    inserted += chunkSize;
  }

  return inserted;
}

/* ── Main ── */

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const db = createDbClient(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('=== Seed Expand: 290 → 2000 tables ===\n');

    // 1. Read existing datasources and their table counts
    console.log('[1/4] Reading existing datasources...');
    const allDs = await db.select().from(datasources);
    const allTables = await db.select({ name: schemaTables.name, datasourceId: schemaTables.datasourceId }).from(schemaTables);

    let grandTotalNew = 0;
    let grandTotalRows = 0;

    for (const engineConfig of ENGINE_CONFIGS) {
      // Find matching datasource
      const ds = allDs.find((d) => {
        const connConfig = d.connectionConfig as Record<string, unknown> | null;
        return connConfig && (connConfig as { schema?: string }).schema === engineConfig.pgSchema;
      });
      if (!ds) {
        console.log(`  SKIP: No datasource found for pgSchema="${engineConfig.pgSchema}"`);
        continue;
      }

      const existingNames = new Set(
        allTables.filter((t) => t.datasourceId === ds.id).map((t) => t.name),
      );
      const existingCount = existingNames.size;

      // 2. Generate new tables
      console.log(`\n[2/4] ${engineConfig.engineType}: ${existingCount} existing → target ${engineConfig.targetTotal}`);
      const newTables = generateExpandTables(engineConfig, existingCount, existingNames);

      if (newTables.length === 0) {
        console.log(`  Already at target, skipping.`);
        continue;
      }

      console.log(`  Generating ${newTables.length} new tables...`);

      // 3. Insert metadata + create physical tables
      console.log(`[3/4] Inserting metadata and creating physical tables...`);
      let tableCount = 0;
      let rowCount = 0;

      for (const tableDef of newTables) {
        // Insert schema_tables
        const [tableRow] = await db.insert(schemaTables).values({
          datasourceId: ds.id,
          name: tableDef.name,
          comment: tableDef.comment,
          rowCount: 100,
          layer: tableDef.layer,
          domain: tableDef.domain,
        }).returning();

        // Insert schema_columns
        if (tableDef.columns.length > 0) {
          await db.insert(schemaColumns).values(
            tableDef.columns.map((col, idx) => ({
              tableId: tableRow.id,
              name: col.name,
              dataType: col.dataType,
              comment: col.comment,
              isPrimaryKey: col.isPrimaryKey ?? false,
              isNullable: col.isNullable ?? true,
              isPii: col.isPii ?? false,
              sampleValues: col.sampleValues ?? null,
              ordinalPosition: idx + 1,
            })),
          );
        }

        // Create physical table
        const ddl = generateDDL(engineConfig.pgSchema, tableDef);
        try {
          await pool.query(ddl);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`  DDL FAIL: ${tableDef.name}: ${msg}\n`);
          continue;
        }

        // Insert sample data
        try {
          const rows = await insertSampleRows(pool, engineConfig.pgSchema, tableDef, 100);
          rowCount += rows;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stderr.write(`  DATA FAIL: ${tableDef.name}: ${msg}\n`);
        }

        tableCount++;
        if (tableCount % 50 === 0) {
          console.log(`    ... ${tableCount}/${newTables.length} tables done`);
        }
      }

      console.log(`  Done: +${tableCount} tables, +${rowCount} rows`);
      grandTotalNew += tableCount;
      grandTotalRows += rowCount;
    }

    console.log(`\n[4/4] Summary: +${grandTotalNew} new tables, +${grandTotalRows} sample rows`);
    console.log('=== Seed expand complete! ===');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed expand failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

In `packages/api/package.json`, add to scripts:

```json
"seed:expand": "tsx src/seed/seed-expand.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/seed/seed-expand.ts packages/api/package.json
git commit -m "feat(seed): add seed-expand script for production table expansion"
```

---

### Task 6: Local Dry-Run Validation

- [ ] **Step 1: Run TypeScript compilation check**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run a dry-run locally to verify table generation counts**

Create a quick validation that generates tables without DB writes — run seed-expand with a non-existent DB URL to test just the generation logic, or add a `--dry-run` flag. Alternatively, verify by adding a temporary log:

```bash
cd packages/api && DATABASE_URL=postgresql://localhost:5432/nl2sql npx tsx src/seed/seed-expand.ts
```

Verify output shows ~1710 new tables distributed across 5 engines.

- [ ] **Step 3: Fix any issues found during validation**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(seed): resolve expand script issues found during dry-run"
```

---

### Task 7: Production Deployment

- [ ] **Step 1: SSH to production and run the expand script**

```bash
ssh -i ~/Downloads/aix-ops-hub-key.pem ubuntu@13.214.45.162
cd /opt/aix-ops-hub/nl2sql
git pull origin main
pnpm install
cd packages/api
DATABASE_URL=<prod_url> npx tsx src/seed/seed-expand.ts
```

- [ ] **Step 2: Verify table counts on production**

```sql
SELECT 
  d.name as datasource,
  COUNT(t.id) as table_count
FROM schema_tables t
JOIN datasources d ON t.datasource_id = d.id
GROUP BY d.name
ORDER BY d.name;
```

Expected: Each datasource shows ~400 tables, total ~2000.

- [ ] **Step 3: Verify physical tables exist**

```sql
SELECT schemaname, COUNT(*) 
FROM pg_tables 
WHERE schemaname LIKE 'dw_%' 
GROUP BY schemaname;
```

Expected: ~400 tables per schema.
