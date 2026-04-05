/**
 * Column template registry for seed expansion.
 *
 * Generates realistic column definitions for database tables based on
 * their warehouse layer, business domain, and specific area.
 * All comments are in Chinese for enterprise NL2SQL demo context.
 */
import type { ColumnDef } from '../engines/types.js';

/* ═══════════════════════════════════════════════
 * Type aliases
 * ═══════════════════════════════════════════════ */

export type Layer = 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
export type Domain = 'trade' | 'user' | 'product' | 'risk';

/* ═══════════════════════════════════════════════
 * Column builder shortcuts
 * ═══════════════════════════════════════════════ */

const c = {
  pk: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'BIGINT', comment, isPrimaryKey: true }),
  bigint: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'BIGINT', comment, ...opts }),
  int: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'INT', comment, ...opts }),
  varchar: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'VARCHAR(255)', comment, ...opts }),
  decimal: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DECIMAL(18,2)', comment }),
  double: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DOUBLE', comment }),
  datetime: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'DATETIME', comment }),
  date: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'DATE', comment, ...opts }),
  text: (name: string, comment: string, opts?: Partial<ColumnDef>): ColumnDef =>
    ({ name, dataType: 'TEXT', comment, ...opts }),
  bool: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'BOOLEAN', comment }),
  timestamp: (name: string, comment: string): ColumnDef =>
    ({ name, dataType: 'TIMESTAMP', comment }),
};

/* ═══════════════════════════════════════════════
 * Base columns per warehouse layer
 * ═══════════════════════════════════════════════ */

const BASE_COLUMNS: Record<Layer, () => ColumnDef[]> = {
  ods: () => [
    c.pk('id', '主键ID'),
    c.varchar('source_system', '来源系统标识'),
    c.datetime('created_at', '创建时间'),
    c.datetime('updated_at', '更新时间'),
    c.date('ds', '数据分区日期'),
  ],
  dwd: () => [
    c.pk('id', '主键ID'),
    c.datetime('etl_time', 'ETL处理时间'),
    c.date('ds', '数据分区日期'),
  ],
  dws: () => [
    c.pk('id', '主键ID'),
    c.date('stat_date', '统计日期'),
  ],
  dim: () => [
    c.pk('id', '主键ID'),
    c.varchar('code', '编码'),
    c.varchar('name', '名称'),
    c.int('status', '状态：1-有效 0-无效'),
    c.date('valid_from', '生效日期'),
    c.date('valid_to', '失效日期'),
  ],
  ads: () => [
    c.pk('id', '主键ID'),
    c.date('stat_date', '统计日期'),
    c.varchar('period_type', '统计周期类型：day/week/month'),
  ],
};

/* ═══════════════════════════════════════════════
 * Aggregation columns for DWS / ADS layers
 * ═══════════════════════════════════════════════ */

const AGG_COLUMNS: ColumnDef[] = [
  c.bigint('total_count', '总计数'),
  c.decimal('total_amount', '总金额'),
  c.double('avg_value', '平均值'),
  c.double('rate', '比率'),
  c.double('mom_change', '环比变化率'),
  c.double('yoy_change', '同比变化率'),
];

/**
 * Pick N aggregation columns starting from a deterministic offset
 * so different tables get varied subsets.
 */
function pickAggColumns(area: string, count: number): ColumnDef[] {
  let hash = 0;
  for (let i = 0; i < area.length; i++) {
    hash = (hash * 31 + area.charCodeAt(i)) | 0;
  }
  const offset = Math.abs(hash) % AGG_COLUMNS.length;
  const result: ColumnDef[] = [];
  for (let i = 0; i < count; i++) {
    result.push(AGG_COLUMNS[(offset + i) % AGG_COLUMNS.length]);
  }
  return result;
}

/* ═══════════════════════════════════════════════
 * Domain-specific column registry
 * ═══════════════════════════════════════════════ */

const DOMAIN_COLUMNS: Record<Domain, Record<string, () => ColumnDef[]>> = {
  /* ─── trade domain (20 areas) ─── */
  trade: {
    order: () => [
      c.varchar('order_no', '订单编号'),
      c.bigint('user_id', '用户ID'),
      c.decimal('order_amount', '订单金额'),
      c.int('order_status', '订单状态：1-待付款 2-已付款 3-已发货 4-已完成 5-已取消'),
      c.varchar('channel', '下单渠道：app/web/mini_program'),
      c.datetime('order_time', '下单时间'),
    ],
    payment: () => [
      c.varchar('payment_no', '支付流水号'),
      c.bigint('order_id', '关联订单ID'),
      c.decimal('pay_amount', '支付金额'),
      c.varchar('pay_method', '支付方式：alipay/wechat/card/balance'),
      c.int('pay_status', '支付状态：0-待支付 1-成功 2-失败 3-已退款'),
      c.datetime('pay_time', '支付完成时间'),
    ],
    refund: () => [
      c.varchar('refund_no', '退款单号'),
      c.bigint('order_id', '关联订单ID'),
      c.decimal('refund_amount', '退款金额'),
      c.int('refund_reason', '退款原因码'),
      c.varchar('refund_desc', '退款原因描述'),
      c.int('refund_status', '退款状态：0-申请中 1-审核中 2-已退款 3-已拒绝'),
    ],
    logistics: () => [
      c.varchar('tracking_no', '物流单号'),
      c.bigint('order_id', '关联订单ID'),
      c.varchar('carrier', '物流公司编码'),
      c.int('logistics_status', '物流状态：1-已揽收 2-运输中 3-派送中 4-已签收'),
      c.varchar('current_city', '当前所在城市'),
      c.datetime('estimated_arrival', '预计到达时间'),
    ],
    settlement: () => [
      c.varchar('settle_no', '结算单号'),
      c.bigint('merchant_id', '商户ID'),
      c.decimal('settle_amount', '结算金额'),
      c.decimal('commission_fee', '平台佣金'),
      c.int('settle_status', '结算状态：0-待结算 1-结算中 2-已结算'),
      c.date('settle_date', '结算日期'),
    ],
    invoice: () => [
      c.varchar('invoice_no', '发票号码'),
      c.bigint('order_id', '关联订单ID'),
      c.decimal('invoice_amount', '开票金额'),
      c.varchar('invoice_type', '发票类型：normal/special/electronic'),
      c.varchar('buyer_tax_no', '购方税号'),
      c.int('invoice_status', '发票状态：0-待开票 1-已开票 2-已作废'),
    ],
    contract: () => [
      c.varchar('contract_no', '合同编号'),
      c.bigint('merchant_id', '商户ID'),
      c.varchar('contract_type', '合同类型：purchase/sale/service'),
      c.decimal('contract_amount', '合同金额'),
      c.date('effective_date', '合同生效日期'),
      c.int('contract_status', '合同状态：0-草稿 1-生效 2-到期 3-终止'),
    ],
    commission: () => [
      c.bigint('merchant_id', '商户ID'),
      c.bigint('order_id', '关联订单ID'),
      c.decimal('commission_amount', '佣金金额'),
      c.double('commission_rate', '佣金费率'),
      c.varchar('commission_type', '佣金类型：basic/tiered/bonus'),
      c.int('settle_flag', '是否已结算：0-未结算 1-已结算'),
    ],
    subscription: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('plan_code', '订阅套餐编码'),
      c.decimal('plan_price', '套餐价格'),
      c.int('billing_cycle', '计费周期(月)'),
      c.datetime('next_billing_date', '下次扣费时间'),
      c.int('sub_status', '订阅状态：1-活跃 2-暂停 3-已取消'),
    ],
    coupon_usage: () => [
      c.bigint('coupon_id', '优惠券ID'),
      c.bigint('user_id', '用户ID'),
      c.bigint('order_id', '关联订单ID'),
      c.decimal('discount_amount', '优惠金额'),
      c.varchar('coupon_type', '券类型：full_reduce/discount/cash'),
      c.datetime('use_time', '使用时间'),
    ],
    flash_sale: () => [
      c.bigint('activity_id', '秒杀活动ID'),
      c.bigint('sku_id', '商品SKU ID'),
      c.decimal('flash_price', '秒杀价格'),
      c.int('stock_limit', '限购库存数量'),
      c.int('sold_count', '已售数量'),
      c.datetime('start_time', '秒杀开始时间'),
    ],
    group_buy: () => [
      c.varchar('group_no', '拼团编号'),
      c.bigint('sku_id', '商品SKU ID'),
      c.decimal('group_price', '拼团价格'),
      c.int('required_count', '成团人数'),
      c.int('current_count', '当前参团人数'),
      c.int('group_status', '拼团状态：0-拼团中 1-已成团 2-已失败'),
    ],
    pre_sale: () => [
      c.bigint('activity_id', '预售活动ID'),
      c.bigint('sku_id', '商品SKU ID'),
      c.decimal('deposit_amount', '定金金额'),
      c.decimal('final_amount', '尾款金额'),
      c.datetime('pay_start_time', '尾款支付开始时间'),
      c.int('presale_status', '预售状态：0-预约中 1-定金支付 2-尾款支付 3-已完成'),
    ],
    cross_border: () => [
      c.varchar('customs_no', '报关单号'),
      c.bigint('order_id', '关联订单ID'),
      c.varchar('origin_country', '商品原产国'),
      c.decimal('tax_amount', '关税金额'),
      c.varchar('customs_status', '清关状态：pending/cleared/rejected'),
      c.varchar('warehouse_code', '保税仓编码'),
    ],
    after_sale: () => [
      c.varchar('service_no', '售后服务单号'),
      c.bigint('order_id', '关联订单ID'),
      c.int('service_type', '服务类型：1-退货 2-换货 3-维修'),
      c.varchar('reason_code', '售后原因编码'),
      c.int('service_status', '售后状态：0-待处理 1-处理中 2-已完成 3-已关闭'),
      c.datetime('apply_time', '申请时间'),
    ],
    dispute: () => [
      c.varchar('dispute_no', '纠纷单号'),
      c.bigint('order_id', '关联订单ID'),
      c.bigint('user_id', '发起用户ID'),
      c.int('dispute_type', '纠纷类型：1-质量问题 2-描述不符 3-物流问题'),
      c.int('dispute_status', '纠纷状态：0-待仲裁 1-处理中 2-已判决'),
      c.text('dispute_detail', '纠纷详情'),
    ],
    evaluation: () => [
      c.bigint('order_id', '关联订单ID'),
      c.bigint('sku_id', '商品SKU ID'),
      c.int('score', '评分：1-5星'),
      c.text('content', '评价内容'),
      c.int('has_image', '是否含图：0-否 1-是'),
      c.int('is_anonymous', '是否匿名：0-否 1-是'),
    ],
    cart: () => [
      c.bigint('user_id', '用户ID'),
      c.bigint('sku_id', '商品SKU ID'),
      c.int('quantity', '加购数量'),
      c.decimal('unit_price', '加购时单价'),
      c.datetime('add_time', '加入购物车时间'),
      c.int('is_selected', '是否勾选：0-否 1-是'),
    ],
    checkout: () => [
      c.varchar('checkout_no', '结算单号'),
      c.bigint('user_id', '用户ID'),
      c.decimal('total_amount', '结算总金额'),
      c.decimal('discount_amount', '优惠总金额'),
      c.bigint('address_id', '收货地址ID'),
      c.int('checkout_status', '结算状态：0-待支付 1-支付中 2-已支付 3-已放弃'),
    ],
    delivery_fee: () => [
      c.bigint('order_id', '关联订单ID'),
      c.decimal('fee_amount', '运费金额'),
      c.varchar('fee_rule', '运费规则：free/fixed/weight/distance'),
      c.double('weight_kg', '包裹重量(kg)'),
      c.varchar('region_code', '配送区域编码'),
      c.bool('is_free_shipping', '是否包邮'),
    ],
  },

  /* ─── user domain (20 areas) ─── */
  user: {
    register: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('register_channel', '注册渠道：app/web/mini_program/h5'),
      c.varchar('register_ip', '注册IP地址'),
      c.varchar('device_type', '注册设备类型'),
      c.varchar('invite_code', '邀请码'),
      c.datetime('register_time', '注册时间'),
    ],
    profile: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('nickname', '昵称', { isPii: true }),
      c.varchar('phone', '手机号码', { isPii: true }),
      c.varchar('email', '电子邮箱', { isPii: true }),
      c.int('gender', '性别：0-未知 1-男 2-女'),
      c.date('birthday', '出生日期', { isPii: true }),
    ],
    login: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('login_ip', '登录IP'),
      c.varchar('login_device', '登录设备标识'),
      c.varchar('login_method', '登录方式：password/sms/oauth/biometric'),
      c.int('login_result', '登录结果：1-成功 0-失败'),
      c.datetime('login_time', '登录时间'),
    ],
    session: () => [
      c.varchar('session_id', '会话ID'),
      c.bigint('user_id', '用户ID'),
      c.varchar('device_id', '设备标识'),
      c.int('page_views', '页面浏览数'),
      c.int('duration_sec', '会话时长(秒)'),
      c.datetime('session_start', '会话开始时间'),
    ],
    behavior: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('event_type', '行为类型：click/view/search/share/collect'),
      c.varchar('page_id', '页面标识'),
      c.varchar('element_id', '元素标识'),
      c.text('event_params', '事件参数(JSON)'),
      c.datetime('event_time', '事件发生时间'),
    ],
    preference: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('category_pref', '偏好品类编码'),
      c.varchar('price_range', '价格偏好区间'),
      c.varchar('brand_pref', '偏好品牌'),
      c.double('pref_score', '偏好得分'),
      c.datetime('calc_time', '计算更新时间'),
    ],
    feedback: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('feedback_type', '反馈类型：suggestion/complaint/praise/bug'),
      c.text('feedback_content', '反馈内容'),
      c.int('priority', '优先级：1-低 2-中 3-高'),
      c.int('handle_status', '处理状态：0-待处理 1-处理中 2-已处理'),
      c.datetime('submit_time', '提交时间'),
    ],
    notification: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('notify_type', '通知类型：sms/push/email/in_app'),
      c.varchar('template_code', '模板编码'),
      c.varchar('biz_type', '业务类型：order/promo/system'),
      c.int('is_read', '是否已读：0-未读 1-已读'),
      c.datetime('send_time', '发送时间'),
    ],
    membership: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('level_code', '会员等级编码'),
      c.int('growth_value', '成长值'),
      c.decimal('cumulative_spend', '累计消费金额'),
      c.date('level_expire_date', '等级到期日期'),
      c.int('is_active', '是否活跃：0-否 1-是'),
    ],
    address: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('receiver_name', '收件人姓名', { isPii: true }),
      c.varchar('receiver_phone', '收件人手机', { isPii: true }),
      c.varchar('province', '省份'),
      c.varchar('city', '城市'),
      c.text('detail_address', '详细地址', { isPii: true }),
    ],
    device: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('device_id', '设备唯一标识'),
      c.varchar('device_model', '设备型号'),
      c.varchar('os_type', '操作系统：ios/android/windows/mac'),
      c.varchar('app_version', 'APP版本号'),
      c.datetime('last_active_time', '最后活跃时间'),
    ],
    credit: () => [
      c.bigint('user_id', '用户ID'),
      c.int('credit_score', '信用分'),
      c.decimal('credit_limit', '信用额度'),
      c.decimal('used_amount', '已用额度'),
      c.int('overdue_count', '逾期次数'),
      c.datetime('score_update_time', '信用分更新时间'),
    ],
    identity: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('id_type', '证件类型：id_card/passport/driver_license'),
      c.varchar('id_number_hash', '证件号码哈希', { isPii: true }),
      c.int('verify_status', '实名状态：0-未认证 1-已认证 2-认证失败'),
      c.varchar('real_name_enc', '姓名密文', { isPii: true }),
      c.datetime('verify_time', '认证时间'),
    ],
    social: () => [
      c.bigint('user_id', '用户ID'),
      c.bigint('target_user_id', '目标用户ID'),
      c.varchar('relation_type', '关系类型：follow/friend/block'),
      c.int('intimacy_score', '亲密度分数'),
      c.int('interaction_count', '互动次数'),
      c.datetime('relation_time', '建立关系时间'),
    ],
    invite: () => [
      c.bigint('inviter_id', '邀请人ID'),
      c.bigint('invitee_id', '被邀请人ID'),
      c.varchar('invite_code', '邀请码'),
      c.varchar('invite_channel', '邀请渠道：link/qrcode/sms/social'),
      c.int('invite_status', '邀请状态：0-待注册 1-已注册 2-已奖励'),
      c.datetime('invite_time', '邀请时间'),
    ],
    growth_task: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('task_code', '成长任务编码'),
      c.varchar('task_name', '任务名称'),
      c.int('reward_points', '奖励积分'),
      c.int('complete_status', '完成状态：0-未完成 1-已完成 2-已领取'),
      c.datetime('complete_time', '完成时间'),
    ],
    signin: () => [
      c.bigint('user_id', '用户ID'),
      c.date('signin_date', '签到日期'),
      c.int('continuous_days', '连续签到天数'),
      c.int('reward_points', '获得积分'),
      c.bool('is_supplement', '是否补签'),
      c.int('monthly_count', '本月签到次数'),
    ],
    points: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('change_type', '变动类型：earn/spend/expire/adjust'),
      c.int('change_amount', '变动数量'),
      c.int('balance', '变动后余额'),
      c.varchar('biz_source', '业务来源：order/task/signin/exchange'),
      c.datetime('change_time', '变动时间'),
    ],
    wallet: () => [
      c.bigint('user_id', '用户ID'),
      c.decimal('balance', '钱包余额'),
      c.decimal('change_amount', '变动金额'),
      c.varchar('trade_type', '交易类型：recharge/withdraw/pay/refund'),
      c.varchar('trade_no', '交易流水号'),
      c.datetime('trade_time', '交易时间'),
    ],
    blacklist: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('block_type', '拉黑类型：fraud/abuse/spam/violation'),
      c.varchar('block_reason', '拉黑原因'),
      c.bigint('operator_id', '操作人ID'),
      c.date('expire_date', '解禁日期'),
      c.int('block_status', '状态：1-生效中 0-已解除'),
    ],
  },

  /* ─── product domain (20 areas) ─── */
  product: {
    catalog: () => [
      c.varchar('category_code', '品类编码'),
      c.varchar('category_name', '品类名称'),
      c.bigint('parent_id', '父级品类ID'),
      c.int('category_level', '品类层级：1-一级 2-二级 3-三级'),
      c.int('sort_order', '排序序号'),
      c.int('is_leaf', '是否叶子节点：0-否 1-是'),
    ],
    sku: () => [
      c.varchar('sku_code', 'SKU编码'),
      c.bigint('spu_id', '关联SPU ID'),
      c.varchar('sku_name', 'SKU名称'),
      c.decimal('sale_price', '销售价格'),
      c.decimal('cost_price', '成本价格'),
      c.int('sku_status', 'SKU状态：0-下架 1-在售 2-预售'),
    ],
    inventory: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.bigint('warehouse_id', '仓库ID'),
      c.int('available_qty', '可用库存数量'),
      c.int('locked_qty', '锁定库存数量'),
      c.int('safety_stock', '安全库存阈值'),
      c.datetime('last_inbound_time', '最近入库时间'),
    ],
    pricing: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.decimal('list_price', '标价'),
      c.decimal('sale_price', '售价'),
      c.decimal('member_price', '会员价'),
      c.double('discount_rate', '折扣率'),
      c.datetime('effective_time', '价格生效时间'),
    ],
    promotion: () => [
      c.varchar('promo_code', '促销活动编码'),
      c.varchar('promo_name', '促销活动名称'),
      c.varchar('promo_type', '促销类型：full_reduce/discount/gift/bundle'),
      c.decimal('threshold_amount', '满减门槛金额'),
      c.decimal('discount_value', '优惠金额/折扣值'),
      c.int('promo_status', '活动状态：0-未开始 1-进行中 2-已结束'),
    ],
    review: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.bigint('user_id', '用户ID'),
      c.int('rating', '评分：1-5'),
      c.text('review_content', '评价内容'),
      c.int('like_count', '点赞数'),
      c.int('is_top', '是否置顶：0-否 1-是'),
    ],
    recommendation: () => [
      c.bigint('user_id', '用户ID'),
      c.bigint('sku_id', '推荐商品SKU ID'),
      c.double('rec_score', '推荐得分'),
      c.varchar('rec_type', '推荐类型：cf/content/hot/personal'),
      c.varchar('rec_scene', '推荐场景：homepage/detail/cart/search'),
      c.int('is_clicked', '是否点击：0-否 1-是'),
    ],
    collection: () => [
      c.bigint('user_id', '用户ID'),
      c.bigint('sku_id', '收藏商品SKU ID'),
      c.varchar('collection_type', '收藏类型：product/shop/content'),
      c.int('is_active', '是否有效：0-已取消 1-有效'),
      c.decimal('price_at_collect', '收藏时价格'),
      c.datetime('collect_time', '收藏时间'),
    ],
    tag: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('tag_code', '标签编码'),
      c.varchar('tag_name', '标签名称'),
      c.varchar('tag_group', '标签分组：quality/style/scene/crowd'),
      c.double('tag_weight', '标签权重'),
      c.int('is_manual', '是否人工标注：0-机器 1-人工'),
    ],
    attribute: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('attr_key', '属性键'),
      c.varchar('attr_value', '属性值'),
      c.varchar('attr_group', '属性分组：basic/spec/sale'),
      c.int('is_searchable', '是否可搜索：0-否 1-是'),
      c.int('sort_order', '排序序号'),
    ],
    warehouse: () => [
      c.varchar('warehouse_code', '仓库编码'),
      c.varchar('warehouse_name', '仓库名称'),
      c.varchar('warehouse_type', '仓库类型：central/regional/bonded/front'),
      c.varchar('city', '所在城市'),
      c.int('capacity', '仓储容量(立方米)'),
      c.int('is_active', '是否启用：0-停用 1-启用'),
    ],
    supplier: () => [
      c.varchar('supplier_code', '供应商编码'),
      c.varchar('supplier_name', '供应商名称'),
      c.varchar('contact_phone', '联系电话'),
      c.int('cooperation_level', '合作等级：1-普通 2-核心 3-战略'),
      c.double('quality_score', '质量评分'),
      c.int('supplier_status', '供应商状态：0-停用 1-启用 2-考察中'),
    ],
    quality: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('batch_no', '批次号'),
      c.varchar('inspect_result', '质检结果：pass/fail/conditional'),
      c.int('defect_count', '缺陷数量'),
      c.double('pass_rate', '合格率'),
      c.datetime('inspect_time', '质检时间'),
    ],
    lifecycle: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('lifecycle_stage', '生命周期阶段：intro/growth/mature/decline/exit'),
      c.int('days_on_sale', '在售天数'),
      c.double('sales_velocity', '销售速度(件/天)'),
      c.decimal('cumulative_revenue', '累计收入'),
      c.date('stage_change_date', '阶段变更日期'),
    ],
    bundle: () => [
      c.varchar('bundle_code', '组合包编码'),
      c.varchar('bundle_name', '组合包名称'),
      c.bigint('sku_id', '包含商品SKU ID'),
      c.int('quantity', '包含数量'),
      c.decimal('bundle_price', '组合价格'),
      c.double('save_rate', '节省比例'),
    ],
    comparison: () => [
      c.bigint('user_id', '用户ID'),
      c.bigint('sku_id_a', '对比商品A的SKU ID'),
      c.bigint('sku_id_b', '对比商品B的SKU ID'),
      c.varchar('compare_dimension', '对比维度：price/spec/review/brand'),
      c.bigint('chosen_sku_id', '最终选择的SKU ID'),
      c.datetime('compare_time', '对比时间'),
    ],
    seo: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('seo_title', 'SEO标题'),
      c.text('seo_keywords', 'SEO关键词'),
      c.text('seo_description', 'SEO描述'),
      c.int('search_rank', '搜索排名'),
      c.int('click_through', '搜索点击次数'),
    ],
    media: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.varchar('media_type', '媒体类型：image/video/3d'),
      c.varchar('media_url', '媒体资源URL'),
      c.int('sort_order', '排序序号'),
      c.int('is_main', '是否主图：0-否 1-是'),
      c.bigint('file_size', '文件大小(bytes)'),
    ],
    variant: () => [
      c.bigint('spu_id', '关联SPU ID'),
      c.varchar('variant_key', '规格键：color/size/material'),
      c.varchar('variant_value', '规格值'),
      c.varchar('variant_image', '规格图片URL'),
      c.int('sort_order', '排序序号'),
      c.int('is_default', '是否默认规格：0-否 1-是'),
    ],
    stock_alert: () => [
      c.bigint('sku_id', '商品SKU ID'),
      c.bigint('warehouse_id', '仓库ID'),
      c.int('current_stock', '当前库存'),
      c.int('alert_threshold', '预警阈值'),
      c.varchar('alert_level', '预警等级：low/critical/out_of_stock'),
      c.datetime('alert_time', '预警触发时间'),
    ],
  },

  /* ─── risk domain (15 areas) ─── */
  risk: {
    fraud_detect: () => [
      c.bigint('event_id', '事件ID'),
      c.bigint('user_id', '用户ID'),
      c.varchar('event_type', '事件类型：login/payment/register/withdraw'),
      c.double('risk_score', '风险评分'),
      c.varchar('risk_level', '风险等级：low/medium/high/critical'),
      c.varchar('hit_rules', '命中规则列表(逗号分隔)'),
    ],
    audit_log: () => [
      c.bigint('operator_id', '操作人ID'),
      c.varchar('action_type', '操作类型：create/update/delete/query/export'),
      c.varchar('resource_type', '资源类型'),
      c.varchar('resource_id', '资源ID'),
      c.text('action_detail', '操作详情(JSON)'),
      c.datetime('action_time', '操作时间'),
    ],
    compliance: () => [
      c.varchar('rule_code', '合规规则编码'),
      c.varchar('check_target', '检查对象类型：merchant/user/transaction'),
      c.bigint('target_id', '检查对象ID'),
      c.int('check_result', '检查结果：0-不合规 1-合规 2-待人工复核'),
      c.varchar('violation_type', '违规类型编码'),
      c.datetime('check_time', '检查时间'),
    ],
    monitor: () => [
      c.varchar('monitor_name', '监控项名称'),
      c.varchar('metric_key', '监控指标键'),
      c.double('metric_value', '指标当前值'),
      c.double('threshold_upper', '上限阈值'),
      c.double('threshold_lower', '下限阈值'),
      c.int('is_triggered', '是否触发告警：0-否 1-是'),
    ],
    alert: () => [
      c.varchar('alert_id', '告警ID'),
      c.varchar('alert_type', '告警类型：threshold/anomaly/pattern/trend'),
      c.varchar('alert_level', '告警等级：info/warning/critical'),
      c.varchar('alert_source', '告警来源模块'),
      c.int('handle_status', '处理状态：0-待处理 1-已确认 2-已忽略 3-已处理'),
      c.datetime('alert_time', '告警时间'),
    ],
    rule_engine: () => [
      c.varchar('rule_code', '规则编码'),
      c.varchar('rule_name', '规则名称'),
      c.varchar('rule_category', '规则类别：velocity/amount/device/behavior'),
      c.text('rule_expression', '规则表达式(DSL)'),
      c.int('priority', '优先级'),
      c.int('is_enabled', '是否启用：0-停用 1-启用'),
    ],
    blocklist: () => [
      c.varchar('block_type', '黑名单类型：user/device/ip/card/phone'),
      c.varchar('block_value', '黑名单值'),
      c.varchar('block_reason', '加入原因'),
      c.bigint('operator_id', '操作人ID'),
      c.date('expire_date', '过期日期'),
      c.int('is_active', '是否生效：0-已失效 1-生效中'),
    ],
    verification: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('verify_type', '验证类型：sms/email/face/id_card/bank_card'),
      c.varchar('verify_channel', '验证渠道'),
      c.int('verify_result', '验证结果：0-失败 1-成功 2-超时'),
      c.int('attempt_count', '尝试次数'),
      c.datetime('verify_time', '验证时间'),
    ],
    credit_score: () => [
      c.bigint('user_id', '用户ID'),
      c.int('score', '信用评分'),
      c.varchar('score_level', '评分等级：A/B/C/D/E'),
      c.int('score_change', '评分变动值'),
      c.varchar('change_reason', '变动原因'),
      c.datetime('calc_time', '评分计算时间'),
    ],
    anti_spam: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('content_type', '内容类型：comment/message/review/post'),
      c.text('content_hash', '内容哈希'),
      c.double('spam_score', '垃圾内容评分'),
      c.varchar('detect_method', '检测方式：keyword/model/manual'),
      c.int('is_spam', '是否垃圾内容：0-否 1-是'),
    ],
    device_fingerprint: () => [
      c.varchar('fingerprint_id', '设备指纹ID'),
      c.bigint('user_id', '关联用户ID'),
      c.varchar('device_hash', '设备特征哈希'),
      c.varchar('browser_info', '浏览器信息'),
      c.int('risk_tag', '风险标记：0-正常 1-模拟器 2-代理 3-多开'),
      c.datetime('first_seen_time', '首次发现时间'),
    ],
    ip_risk: () => [
      c.varchar('ip_address', 'IP地址'),
      c.varchar('ip_type', 'IP类型：residential/datacenter/proxy/tor'),
      c.varchar('geo_country', '地理位置-国家'),
      c.varchar('geo_city', '地理位置-城市'),
      c.int('risk_level', '风险等级：0-正常 1-可疑 2-高危'),
      c.int('associated_accounts', '关联账户数量'),
    ],
    transaction_risk: () => [
      c.varchar('transaction_id', '交易ID'),
      c.bigint('user_id', '用户ID'),
      c.decimal('transaction_amount', '交易金额'),
      c.double('risk_score', '风险评分'),
      c.varchar('risk_factors', '风险因子(逗号分隔)'),
      c.int('decision', '风控决策：0-放行 1-人审 2-拒绝'),
    ],
    account_security: () => [
      c.bigint('user_id', '用户ID'),
      c.varchar('event_type', '安全事件类型：pwd_change/bindphone/bindmail/device_add'),
      c.varchar('event_ip', '事件IP地址'),
      c.varchar('event_device', '事件设备标识'),
      c.int('risk_flag', '风险标记：0-正常 1-异常'),
      c.datetime('event_time', '事件时间'),
    ],
    data_quality: () => [
      c.varchar('table_name', '表名'),
      c.varchar('column_name', '字段名'),
      c.varchar('rule_type', '规则类型：null_check/range/format/unique/fk'),
      c.bigint('total_rows', '总行数'),
      c.bigint('fail_rows', '不合格行数'),
      c.double('pass_rate', '合格率'),
    ],
  },
};

/* ═══════════════════════════════════════════════
 * Generic fallback columns
 * ═══════════════════════════════════════════════ */

function genericColumns(): ColumnDef[] {
  return [
    c.varchar('biz_code', '业务编码'),
    c.varchar('biz_name', '业务名称'),
    c.int('biz_status', '业务状态'),
    c.decimal('biz_amount', '业务金额'),
    c.text('remark', '备注'),
    c.datetime('biz_time', '业务时间'),
  ];
}

/* ═══════════════════════════════════════════════
 * Public API
 * ═══════════════════════════════════════════════ */

/**
 * Generate a complete column list for a table given its warehouse layer,
 * business domain, and specific area.
 *
 * For DWS/ADS layers, some domain-specific columns are replaced with
 * aggregation columns (total_count, total_amount, avg_value, rate, etc.)
 * to reflect their summarized nature.
 */
export function generateColumns(layer: Layer, domain: Domain, area: string): ColumnDef[] {
  const base = BASE_COLUMNS[layer]();

  const areaRegistry = DOMAIN_COLUMNS[domain];
  const domainColsFn = areaRegistry[area];
  const domainCols = domainColsFn ? domainColsFn() : genericColumns();

  if (layer === 'dws' || layer === 'ads') {
    /* Keep first 3 domain columns for context, replace rest with agg columns */
    const contextCols = domainCols.slice(0, 3);
    const usedNames = new Set([...base, ...contextCols].map((col) => col.name));
    const aggCols = pickAggColumns(area, 3).filter((col) => !usedNames.has(col.name));
    return [...base, ...contextCols, ...aggCols];
  }

  return [...base, ...domainCols];
}
