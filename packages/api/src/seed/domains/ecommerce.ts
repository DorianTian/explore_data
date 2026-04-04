import type { DomainDefinition, TableDef } from './types.js';
import { col, generateSummaryTable } from '../generator.js';

/* ──────────────────────────────────────────────
 * ODS Layer (~60 tables) — Raw source tables
 * ────────────────────────────────────────────── */

const odsTables: TableDef[] = [
  // ── Users & Membership ──
  {
    name: 'ods_users',
    comment: '用户基础信息表',
    layer: 'ods',
    columns: [
      col.id('用户ID'),
      col.varchar('username', 50, '用户名', { isNullable: false }),
      col.varchar('nickname', 100, '昵称'),
      col.varchar('email', 100, '邮箱'),
      col.varchar('phone', 20, '手机号', { isPii: true }),
      col.varchar('password_hash', 255, '密码哈希'),
      col.varchar('gender', 10, '性别: male/female/unknown'),
      col.date('birthday', '出生日期'),
      col.varchar('avatar_url', 500, '头像URL'),
      col.varchar('register_source', 30, '注册来源: app/wechat/web/h5'),
      col.varchar('register_ip', 50, '注册IP'),
      col.status('账号状态', 'active/frozen/deleted'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_user_addresses',
    comment: '用户收货地址表',
    layer: 'ods',
    columns: [
      col.id('地址ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('receiver_name', 50, '收件人姓名'),
      col.varchar('receiver_phone', 20, '收件人手机号', { isPii: true }),
      col.varchar('province', 30, '省'),
      col.varchar('city', 30, '市'),
      col.varchar('district', 30, '区'),
      col.text('detail_address', '详细地址'),
      col.varchar('zip_code', 10, '邮编'),
      col.bool('is_default', '是否默认地址', 'false'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_user_login_logs',
    comment: '用户登录日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.timestamp('login_time', '登录时间'),
      col.varchar('login_ip', 50, '登录IP'),
      col.varchar('device_type', 30, '设备类型: ios/android/web'),
      col.varchar('device_model', 100, '设备型号'),
      col.varchar('app_version', 20, '应用版本'),
      col.varchar('login_method', 20, '登录方式: password/sms/wechat'),
      col.bool('login_success', '是否登录成功', 'true'),
    ],
  },
  {
    name: 'ods_membership_levels',
    comment: '会员等级定义表',
    layer: 'ods',
    columns: [
      col.id('等级ID'),
      col.varchar('level_name', 30, '等级名称'),
      col.int('level_code', '等级编码'),
      col.int('min_points', '所需最低积分'),
      col.decimal('discount_rate', '5,2', '折扣率'),
      col.int('free_shipping_threshold', '免邮门槛(分)'),
      col.text('benefits_desc', '权益描述'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_user_memberships',
    comment: '用户会员信息表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('level_id', 'ods_membership_levels', '当前等级ID'),
      col.int('current_points', '当前积分'),
      col.int('total_points', '累计积分'),
      col.decimal('total_spent', '18,2', '累计消费金额'),
      col.date('level_expire_date', '等级过期日期'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_user_points_logs',
    comment: '用户积分变动日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.int('points_change', '积分变动'),
      col.varchar('change_type', 30, '变动类型: earn/redeem/expire/adjust'),
      col.varchar('source', 50, '变动来源'),
      col.varchar('ref_order_id', 50, '关联订单号'),
      col.int('balance_after', '变动后余额'),
      col.createdAt(),
    ],
  },

  // ── Products & Categories ──
  {
    name: 'ods_categories',
    comment: '商品类目表',
    layer: 'ods',
    columns: [
      col.id('类目ID'),
      col.varchar('category_name', 100, '类目名称', { isNullable: false }),
      col.bigint('parent_id', '父类目ID'),
      col.int('level', '类目层级: 1/2/3'),
      col.varchar('category_path', 200, '类目路径'),
      col.int('sort_order', '排序权重'),
      col.bool('is_leaf', '是否叶子节点', 'false'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_brands',
    comment: '品牌信息表',
    layer: 'ods',
    columns: [
      col.id('品牌ID'),
      col.varchar('brand_name', 100, '品牌名称', { isNullable: false }),
      col.varchar('brand_name_en', 100, '品牌英文名'),
      col.varchar('logo_url', 500, '品牌Logo'),
      col.varchar('country', 30, '品牌产地'),
      col.text('description', '品牌描述'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_products',
    comment: '商品主表(SPU)',
    layer: 'ods',
    columns: [
      col.id('商品ID'),
      col.varchar('product_name', 200, '商品名称', { isNullable: false }),
      col.fk('category_id', 'ods_categories', '所属类目ID'),
      col.fk('brand_id', 'ods_brands', '品牌ID'),
      col.decimal('original_price', '12,2', '原价(元)'),
      col.decimal('selling_price', '12,2', '售卖价(元)'),
      col.decimal('cost_price', '12,2', '成本价(元)'),
      col.varchar('unit', 20, '计量单位'),
      col.decimal('weight', '10,3', '重量(kg)'),
      col.text('description', '商品描述'),
      col.json('attributes', '商品扩展属性'),
      col.status('状态', 'on_sale/off_sale/deleted'),
      col.bool('is_virtual', '是否虚拟商品', 'false'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_product_skus',
    comment: '商品SKU表',
    layer: 'ods',
    columns: [
      col.id('SKU ID'),
      col.fk('product_id', 'ods_products', '关联SPU ID'),
      col.varchar('sku_code', 50, 'SKU编码', { isNullable: false }),
      col.varchar('sku_name', 200, 'SKU名称'),
      col.json('spec_values', '规格值JSON: {"颜色":"红","尺码":"XL"}'),
      col.decimal('price', '12,2', 'SKU价格'),
      col.decimal('cost_price', '12,2', 'SKU成本价'),
      col.varchar('barcode', 50, '条形码'),
      col.varchar('image_url', 500, 'SKU图片'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_product_images',
    comment: '商品图片表',
    layer: 'ods',
    columns: [
      col.id('图片ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.varchar('image_url', 500, '图片URL'),
      col.varchar('image_type', 20, '图片类型: main/detail/sku'),
      col.int('sort_order', '排序'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_product_tags',
    comment: '商品标签关联表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.varchar('tag_name', 50, '标签名称'),
      col.varchar('tag_type', 30, '标签类型: manual/auto'),
      col.createdAt(),
    ],
  },

  // ── Inventory ──
  {
    name: 'ods_warehouses',
    comment: '仓库信息表',
    layer: 'ods',
    columns: [
      col.id('仓库ID'),
      col.varchar('warehouse_name', 100, '仓库名称'),
      col.varchar('warehouse_code', 30, '仓库编码'),
      col.varchar('province', 30, '所在省'),
      col.varchar('city', 30, '所在市'),
      col.text('address', '详细地址'),
      col.varchar('contact_phone', 20, '联系电话'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_inventory',
    comment: '库存表',
    layer: 'ods',
    columns: [
      col.id('库存ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.fk('warehouse_id', 'ods_warehouses', '仓库ID'),
      col.int('available_qty', '可用库存'),
      col.int('locked_qty', '锁定库存'),
      col.int('total_qty', '总库存'),
      col.int('alert_qty', '预警库存阈值'),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_inventory_logs',
    comment: '库存变动日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.fk('warehouse_id', 'ods_warehouses', '仓库ID'),
      col.int('qty_change', '变动数量'),
      col.varchar('change_type', 30, '变动类型: inbound/outbound/lock/unlock/adjust'),
      col.varchar('ref_no', 50, '关联单据号'),
      col.int('qty_after', '变动后库存'),
      col.createdAt(),
    ],
  },

  // ── Orders ──
  {
    name: 'ods_orders',
    comment: '订单主表',
    layer: 'ods',
    columns: [
      col.id('订单ID'),
      col.varchar('order_no', 30, '订单号', { isNullable: false }),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.decimal('total_amount', '12,2', '订单总金额'),
      col.decimal('discount_amount', '12,2', '优惠金额'),
      col.decimal('shipping_fee', '10,2', '运费'),
      col.decimal('pay_amount', '12,2', '实付金额'),
      col.int('total_qty', '商品总数量'),
      col.varchar('order_source', 20, '订单来源: app/web/h5/wechat'),
      col.status('订单状态', 'pending/paid/shipped/delivered/completed/cancelled'),
      col.varchar('receiver_name', 50, '收件人'),
      col.varchar('receiver_phone', 20, '收件人电话', { isPii: true }),
      col.text('shipping_address', '收货地址'),
      col.text('remark', '订单备注'),
      col.timestamp('paid_at', '支付时间'),
      col.timestamp('shipped_at', '发货时间'),
      col.timestamp('delivered_at', '收货时间'),
      col.timestamp('completed_at', '完成时间'),
      col.timestamp('cancelled_at', '取消时间'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_order_items',
    comment: '订单明细表',
    layer: 'ods',
    columns: [
      col.id('明细ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.varchar('product_name', 200, '商品名称快照'),
      col.varchar('sku_name', 200, 'SKU名称快照'),
      col.decimal('unit_price', '12,2', '下单单价'),
      col.int('quantity', '购买数量'),
      col.decimal('discount_amount', '12,2', '分摊优惠金额'),
      col.decimal('subtotal', '12,2', '小计金额'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_order_status_logs',
    comment: '订单状态变更日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.varchar('from_status', 30, '原状态'),
      col.varchar('to_status', 30, '新状态'),
      col.varchar('operator', 50, '操作人'),
      col.text('remark', '备注'),
      col.createdAt(),
    ],
  },

  // ── Payments ──
  {
    name: 'ods_payments',
    comment: '支付记录表',
    layer: 'ods',
    columns: [
      col.id('支付ID'),
      col.varchar('payment_no', 50, '支付流水号'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.decimal('amount', '12,2', '支付金额'),
      col.varchar('payment_method', 20, '支付方式: alipay/wechat/card/balance'),
      col.varchar('channel_trade_no', 100, '三方交易号'),
      col.status('支付状态', 'pending/success/failed/refunded'),
      col.timestamp('paid_at', '支付成功时间'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_payment_refunds',
    comment: '退款记录表',
    layer: 'ods',
    columns: [
      col.id('退款ID'),
      col.varchar('refund_no', 50, '退款单号'),
      col.fk('payment_id', 'ods_payments', '原支付ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.decimal('refund_amount', '12,2', '退款金额'),
      col.varchar('refund_reason', 200, '退款原因'),
      col.status('退款状态', 'pending/processing/success/failed'),
      col.timestamp('refunded_at', '退款到账时间'),
      col.createdAt(),
    ],
  },

  // ── Promotions & Coupons ──
  {
    name: 'ods_promotions',
    comment: '营销活动表',
    layer: 'ods',
    columns: [
      col.id('活动ID'),
      col.varchar('promo_name', 100, '活动名称', { isNullable: false }),
      col.varchar('promo_type', 30, '活动类型: flash_sale/full_reduction/bundle/gift'),
      col.timestamp('start_time', '开始时间'),
      col.timestamp('end_time', '结束时间'),
      col.json('rules', '活动规则JSON'),
      col.decimal('budget', '12,2', '预算金额'),
      col.decimal('spent', '12,2', '已花费金额'),
      col.status('状态', 'draft/active/paused/ended'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_promotion_products',
    comment: '活动商品关联表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('promotion_id', 'ods_promotions', '活动ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.decimal('promo_price', '12,2', '活动价'),
      col.int('stock_limit', '活动库存限制'),
      col.int('sold_qty', '已售数量'),
    ],
  },
  {
    name: 'ods_coupons',
    comment: '优惠券定义表',
    layer: 'ods',
    columns: [
      col.id('优惠券ID'),
      col.varchar('coupon_name', 100, '优惠券名称'),
      col.varchar('coupon_type', 20, '类型: fixed/percentage/shipping'),
      col.decimal('face_value', '10,2', '面值/折扣率'),
      col.decimal('min_spend', '10,2', '最低消费门槛'),
      col.int('total_issued', '发行总量'),
      col.int('total_used', '已使用数量'),
      col.timestamp('valid_start', '有效期开始'),
      col.timestamp('valid_end', '有效期结束'),
      col.json('applicable_scope', '适用范围JSON'),
      col.status('状态', 'active/expired/exhausted'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_user_coupons',
    comment: '用户优惠券领取记录表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('coupon_id', 'ods_coupons', '优惠券ID'),
      col.varchar('coupon_code', 50, '优惠券码'),
      col.status('状态', 'unused/used/expired'),
      col.fk('used_order_id', 'ods_orders', '使用订单ID'),
      col.timestamp('received_at', '领取时间'),
      col.timestamp('used_at', '使用时间'),
    ],
  },

  // ── Shopping Cart ──
  {
    name: 'ods_shopping_carts',
    comment: '购物车表',
    layer: 'ods',
    columns: [
      col.id('购物车ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.int('quantity', '数量'),
      col.bool('is_checked', '是否勾选', 'true'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },

  // ── Reviews & Ratings ──
  {
    name: 'ods_reviews',
    comment: '商品评价表',
    layer: 'ods',
    columns: [
      col.id('评价ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('order_item_id', 'ods_order_items', '订单明细ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.int('rating', '评分: 1-5'),
      col.text('content', '评价内容'),
      col.json('images', '评价图片URL列表'),
      col.bool('is_anonymous', '是否匿名', 'false'),
      col.int('like_count', '点赞数'),
      col.status('状态', 'visible/hidden/deleted'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_review_replies',
    comment: '评价回复表',
    layer: 'ods',
    columns: [
      col.id('回复ID'),
      col.fk('review_id', 'ods_reviews', '评价ID'),
      col.fk('user_id', 'ods_users', '回复人ID'),
      col.text('content', '回复内容'),
      col.varchar('reply_type', 20, '回复类型: merchant/user'),
      col.createdAt(),
    ],
  },

  // ── After-Sales ──
  {
    name: 'ods_after_sales',
    comment: '售后工单表',
    layer: 'ods',
    columns: [
      col.id('工单ID'),
      col.varchar('after_sale_no', 30, '售后单号'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('type', 20, '售后类型: return/exchange/repair'),
      col.varchar('reason', 200, '售后原因'),
      col.text('description', '问题描述'),
      col.decimal('refund_amount', '12,2', '申请退款金额'),
      col.status('状态', 'submitted/processing/completed/rejected'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_after_sale_items',
    comment: '售后商品明细表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('after_sale_id', 'ods_after_sales', '售后工单ID'),
      col.fk('order_item_id', 'ods_order_items', '订单明细ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.int('quantity', '售后数量'),
      col.createdAt(),
    ],
  },

  // ── Logistics ──
  {
    name: 'ods_logistics_companies',
    comment: '物流公司表',
    layer: 'ods',
    columns: [
      col.id('物流公司ID'),
      col.varchar('company_name', 50, '物流公司名称'),
      col.varchar('company_code', 20, '公司编码'),
      col.varchar('contact_phone', 20, '联系电话'),
      col.varchar('website', 200, '官网'),
      col.status('状态', 'active/inactive'),
    ],
  },
  {
    name: 'ods_shipments',
    comment: '发货记录表',
    layer: 'ods',
    columns: [
      col.id('发货ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('logistics_company_id', 'ods_logistics_companies', '物流公司ID'),
      col.varchar('tracking_no', 50, '物流单号'),
      col.fk('warehouse_id', 'ods_warehouses', '发货仓库ID'),
      col.status('状态', 'pending/picked_up/in_transit/delivered/exception'),
      col.timestamp('shipped_at', '发货时间'),
      col.timestamp('delivered_at', '签收时间'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_shipment_tracks',
    comment: '物流轨迹表',
    layer: 'ods',
    columns: [
      col.id('轨迹ID'),
      col.fk('shipment_id', 'ods_shipments', '发货记录ID'),
      col.timestamp('track_time', '轨迹时间'),
      col.varchar('location', 200, '当前位置'),
      col.text('detail', '轨迹详情'),
    ],
  },

  // ── Stores & Merchants ──
  {
    name: 'ods_stores',
    comment: '店铺信息表',
    layer: 'ods',
    columns: [
      col.id('店铺ID'),
      col.varchar('store_name', 100, '店铺名称', { isNullable: false }),
      col.varchar('store_type', 20, '店铺类型: self/third_party'),
      col.varchar('contact_name', 50, '联系人'),
      col.varchar('contact_phone', 20, '联系电话'),
      col.varchar('business_license', 100, '营业执照号'),
      col.decimal('commission_rate', '5,4', '佣金比例'),
      col.decimal('deposit_amount', '12,2', '保证金'),
      col.status('状态', 'active/frozen/closed'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_store_products',
    comment: '店铺商品关联表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.decimal('store_price', '12,2', '店铺售价'),
      col.bool('is_featured', '是否主推', 'false'),
      col.createdAt(),
    ],
  },

  // ── Content & Search ──
  {
    name: 'ods_articles',
    comment: '内容文章表',
    layer: 'ods',
    columns: [
      col.id('文章ID'),
      col.varchar('title', 200, '标题'),
      col.text('content', '正文'),
      col.fk('author_id', 'ods_users', '作者ID'),
      col.varchar('article_type', 30, '类型: guide/review/news'),
      col.int('view_count', '浏览数'),
      col.int('like_count', '点赞数'),
      col.status('状态', 'draft/published/offline'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_article_products',
    comment: '文章关联商品表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('article_id', 'ods_articles', '文章ID'),
      col.fk('product_id', 'ods_products', '关联商品ID'),
      col.int('sort_order', '排序'),
    ],
  },
  {
    name: 'ods_search_logs',
    comment: '搜索日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('keyword', 200, '搜索关键词'),
      col.int('result_count', '搜索结果数'),
      col.varchar('search_source', 20, '搜索来源: home/category/suggest'),
      col.createdAt(),
    ],
  },

  // ── User Behavior ──
  {
    name: 'ods_page_views',
    comment: '页面浏览事件表',
    layer: 'ods',
    columns: [
      col.id('事件ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('page_type', 30, '页面类型: home/product/category/cart/order'),
      col.varchar('page_id', 50, '页面标识'),
      col.varchar('referrer', 200, '来源页面'),
      col.int('duration_sec', '停留时长(秒)'),
      col.varchar('device_type', 20, '设备类型'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_user_favorites',
    comment: '用户收藏表',
    layer: 'ods',
    columns: [
      col.id('收藏ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '收藏商品ID'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_user_shares',
    comment: '用户分享记录表',
    layer: 'ods',
    columns: [
      col.id('分享ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('share_type', 20, '分享类型: product/article/activity'),
      col.varchar('share_target_id', 50, '被分享对象ID'),
      col.varchar('channel', 20, '分享渠道: wechat/weibo/link'),
      col.int('click_count', '点击次数'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_click_events',
    comment: '点击行为事件表',
    layer: 'ods',
    columns: [
      col.id('事件ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('event_type', 30, '事件类型: click/add_cart/checkout/pay'),
      col.varchar('target_type', 20, '目标类型: product/banner/button'),
      col.varchar('target_id', 50, '目标ID'),
      col.varchar('page_type', 30, '所在页面'),
      col.json('extra', '扩展信息'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_app_crashes',
    comment: 'APP崩溃日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('device_model', 100, '设备型号'),
      col.varchar('os_version', 30, 'OS版本'),
      col.varchar('app_version', 20, 'APP版本'),
      col.text('stack_trace', '崩溃堆栈'),
      col.createdAt(),
    ],
  },

  // ── Notifications & Messages ──
  {
    name: 'ods_push_messages',
    comment: '推送消息表',
    layer: 'ods',
    columns: [
      col.id('消息ID'),
      col.varchar('title', 100, '消息标题'),
      col.text('content', '消息内容'),
      col.varchar('target_type', 20, '目标类型: all/segment/user'),
      col.json('target_ids', '目标用户列表'),
      col.varchar('channel', 20, '推送渠道: push/sms/email'),
      col.int('sent_count', '发送数'),
      col.int('read_count', '已读数'),
      col.timestamp('sent_at', '发送时间'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_sms_logs',
    comment: '短信发送日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('template_code', 50, '短信模板编码'),
      col.varchar('phone', 20, '手机号', { isPii: true }),
      col.varchar('content', 500, '短信内容'),
      col.status('发送状态', 'sent/delivered/failed'),
      col.createdAt(),
    ],
  },

  // ── Platform Settings ──
  {
    name: 'ods_regions',
    comment: '地区字典表',
    layer: 'ods',
    columns: [
      col.id('地区ID'),
      col.varchar('region_name', 50, '地区名称'),
      col.bigint('parent_id', '父地区ID'),
      col.int('level', '层级: 1省/2市/3区'),
      col.varchar('region_code', 10, '行政区划编码'),
    ],
  },
  {
    name: 'ods_platform_config',
    comment: '平台配置表',
    layer: 'ods',
    columns: [
      col.id('配置ID'),
      col.varchar('config_key', 100, '配置键', { isNullable: false }),
      col.text('config_value', '配置值'),
      col.varchar('config_group', 50, '配置分组'),
      col.text('description', '配置说明'),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_banners',
    comment: '首页Banner配置表',
    layer: 'ods',
    columns: [
      col.id('Banner ID'),
      col.varchar('title', 100, 'Banner标题'),
      col.varchar('image_url', 500, '图片URL'),
      col.varchar('link_url', 500, '跳转链接'),
      col.varchar('position', 30, '展示位置: home_top/category/activity'),
      col.int('sort_order', '排序'),
      col.timestamp('start_time', '展示开始时间'),
      col.timestamp('end_time', '展示结束时间'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
    ],
  },

  // ── Commission & Finance ──
  {
    name: 'ods_commission_records',
    comment: '佣金记录表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.decimal('order_amount', '12,2', '订单金额'),
      col.decimal('commission_rate', '5,4', '佣金比例'),
      col.decimal('commission_amount', '12,2', '佣金金额'),
      col.status('状态', 'pending/settled'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_store_settlements',
    comment: '店铺结算单表',
    layer: 'ods',
    columns: [
      col.id('结算ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.varchar('settlement_no', 30, '结算单号'),
      col.date('period_start', '结算周期开始'),
      col.date('period_end', '结算周期结束'),
      col.decimal('total_sales', '14,2', '总销售额'),
      col.decimal('total_commission', '12,2', '总佣金'),
      col.decimal('settlement_amount', '14,2', '应结金额'),
      col.status('状态', 'pending/confirmed/paid'),
      col.createdAt(),
    ],
  },

  // ── Recommendations ──
  {
    name: 'ods_recommend_logs',
    comment: '推荐曝光日志表',
    layer: 'ods',
    columns: [
      col.id('日志ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '推荐商品ID'),
      col.varchar('scene', 30, '推荐场景: homepage/detail/cart/search'),
      col.varchar('algorithm', 50, '推荐算法'),
      col.int('position', '展示位置'),
      col.bool('is_clicked', '是否被点击', 'false'),
      col.bool('is_purchased', '是否产生购买', 'false'),
      col.createdAt(),
    ],
  },

  // ── Additional ODS tables to reach ~60 ──
  {
    name: 'ods_product_specs',
    comment: '商品规格定义表',
    layer: 'ods',
    columns: [
      col.id('规格ID'),
      col.fk('category_id', 'ods_categories', '类目ID'),
      col.varchar('spec_name', 50, '规格名称: 颜色/尺码/容量'),
      col.json('spec_values', '可选值列表JSON'),
      col.int('sort_order', '排序'),
    ],
  },
  {
    name: 'ods_supplier_info',
    comment: '供应商信息表',
    layer: 'ods',
    columns: [
      col.id('供应商ID'),
      col.varchar('supplier_name', 100, '供应商名称'),
      col.varchar('contact_name', 50, '联系人'),
      col.varchar('contact_phone', 20, '联系电话'),
      col.varchar('business_license', 100, '营业执照号'),
      col.varchar('province', 30, '省'),
      col.varchar('city', 30, '市'),
      col.status('状态', 'active/inactive'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_purchase_orders',
    comment: '采购订单表',
    layer: 'ods',
    columns: [
      col.id('采购单ID'),
      col.varchar('po_no', 30, '采购单号'),
      col.fk('supplier_id', 'ods_supplier_info', '供应商ID'),
      col.fk('warehouse_id', 'ods_warehouses', '入库仓ID'),
      col.decimal('total_amount', '14,2', '采购总金额'),
      col.int('total_qty', '采购总数量'),
      col.status('状态', 'draft/submitted/received/cancelled'),
      col.createdAt(),
      col.updatedAt(),
    ],
  },
  {
    name: 'ods_purchase_order_items',
    comment: '采购订单明细表',
    layer: 'ods',
    columns: [
      col.id('明细ID'),
      col.fk('purchase_order_id', 'ods_purchase_orders', '采购单ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.int('quantity', '采购数量'),
      col.decimal('unit_cost', '12,2', '采购单价'),
      col.decimal('subtotal', '12,2', '小计'),
    ],
  },
  {
    name: 'ods_user_feedbacks',
    comment: '用户反馈表',
    layer: 'ods',
    columns: [
      col.id('反馈ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('feedback_type', 20, '反馈类型: bug/suggestion/complaint'),
      col.text('content', '反馈内容'),
      col.json('images', '附件图片'),
      col.status('状态', 'pending/processing/resolved'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_live_streams',
    comment: '直播信息表',
    layer: 'ods',
    columns: [
      col.id('直播ID'),
      col.varchar('stream_title', 200, '直播标题'),
      col.fk('store_id', 'ods_stores', '所属店铺ID'),
      col.varchar('anchor_name', 50, '主播昵称'),
      col.timestamp('start_time', '开播时间'),
      col.timestamp('end_time', '下播时间'),
      col.int('peak_viewers', '最高同时在线人数'),
      col.int('total_viewers', '累计观看人数'),
      col.decimal('total_gmv', '14,2', '直播GMV'),
      col.status('状态', 'upcoming/live/ended'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_live_stream_products',
    comment: '直播商品关联表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('live_stream_id', 'ods_live_streams', '直播ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.decimal('live_price', '12,2', '直播价'),
      col.int('sold_qty', '直播间销量'),
      col.int('sort_order', '排序'),
    ],
  },
  {
    name: 'ods_group_buy_activities',
    comment: '拼团活动表',
    layer: 'ods',
    columns: [
      col.id('活动ID'),
      col.fk('product_id', 'ods_products', '拼团商品ID'),
      col.decimal('group_price', '12,2', '拼团价'),
      col.int('group_size', '成团人数'),
      col.int('time_limit_hours', '拼团时限(小时)'),
      col.int('total_groups', '已成团数'),
      col.timestamp('start_time', '开始时间'),
      col.timestamp('end_time', '结束时间'),
      col.status('状态', 'active/ended'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_group_buy_orders',
    comment: '拼团订单表',
    layer: 'ods',
    columns: [
      col.id('拼团订单ID'),
      col.fk('activity_id', 'ods_group_buy_activities', '拼团活动ID'),
      col.fk('order_id', 'ods_orders', '关联订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('group_no', 30, '团号'),
      col.bool('is_leader', '是否团长', 'false'),
      col.status('状态', 'waiting/success/failed'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_flash_sale_slots',
    comment: '秒杀时段配置表',
    layer: 'ods',
    columns: [
      col.id('时段ID'),
      col.date('sale_date', '秒杀日期'),
      col.varchar('time_slot', 10, '时段: 10:00/14:00/20:00'),
      col.status('状态', 'upcoming/active/ended'),
      col.createdAt(),
    ],
  },
  {
    name: 'ods_flash_sale_items',
    comment: '秒杀商品表',
    layer: 'ods',
    columns: [
      col.id('记录ID'),
      col.fk('slot_id', 'ods_flash_sale_slots', '时段ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.decimal('flash_price', '12,2', '秒杀价'),
      col.int('stock_limit', '秒杀库存'),
      col.int('sold_qty', '已抢数量'),
      col.int('sort_order', '排序'),
    ],
  },
];

/* ──────────────────────────────────────────────
 * DWD Layer (~50 tables) — Star schema
 * ────────────────────────────────────────────── */

const dwdTables: TableDef[] = [
  // ── Dimension Tables ──
  {
    name: 'dim_user',
    comment: '用户维度表',
    layer: 'dwd',
    columns: [
      col.id('用户维度ID'),
      col.fk('user_id', 'ods_users', '来源用户ID'),
      col.varchar('username', 50, '用户名'),
      col.varchar('gender', 10, '性别'),
      col.varchar('age_group', 20, '年龄段: 18-24/25-34/35-44/45+'),
      col.varchar('register_source', 30, '注册来源'),
      col.varchar('membership_level', 30, '会员等级'),
      col.varchar('city', 30, '所在城市'),
      col.varchar('province', 30, '所在省份'),
      col.date('first_order_date', '首单日期'),
      col.date('last_order_date', '最近下单日期'),
      col.varchar('lifecycle_stage', 20, '生命周期: new/active/dormant/lost'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_product',
    comment: '商品维度表',
    layer: 'dwd',
    columns: [
      col.id('商品维度ID'),
      col.fk('product_id', 'ods_products', '来源商品ID'),
      col.varchar('product_name', 200, '商品名称'),
      col.varchar('category_l1', 100, '一级类目'),
      col.varchar('category_l2', 100, '二级类目'),
      col.varchar('category_l3', 100, '三级类目'),
      col.varchar('brand_name', 100, '品牌'),
      col.decimal('selling_price', '12,2', '售卖价'),
      col.decimal('cost_price', '12,2', '成本价'),
      col.varchar('price_range', 30, '价格区间: 0-50/50-200/200-500/500+'),
      col.bool('is_virtual', '是否虚拟商品', 'false'),
      col.status('状态', 'on_sale/off_sale'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_sku',
    comment: 'SKU维度表',
    layer: 'dwd',
    columns: [
      col.id('SKU维度ID'),
      col.fk('sku_id', 'ods_product_skus', '来源SKU ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.varchar('sku_code', 50, 'SKU编码'),
      col.varchar('sku_name', 200, 'SKU名称'),
      col.json('spec_values', '规格值'),
      col.decimal('price', '12,2', '价格'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_store',
    comment: '店铺维度表',
    layer: 'dwd',
    columns: [
      col.id('店铺维度ID'),
      col.fk('store_id', 'ods_stores', '来源店铺ID'),
      col.varchar('store_name', 100, '店铺名称'),
      col.varchar('store_type', 20, '店铺类型'),
      col.decimal('commission_rate', '5,4', '佣金比例'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_warehouse',
    comment: '仓库维度表',
    layer: 'dwd',
    columns: [
      col.id('仓库维度ID'),
      col.fk('warehouse_id', 'ods_warehouses', '来源仓库ID'),
      col.varchar('warehouse_name', 100, '仓库名称'),
      col.varchar('warehouse_code', 30, '仓库编码'),
      col.varchar('province', 30, '省'),
      col.varchar('city', 30, '市'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_date',
    comment: '日期维度表',
    layer: 'dwd',
    columns: [
      col.id('日期ID'),
      col.date('date_key', '日期'),
      col.int('year', '年'),
      col.int('quarter', '季度'),
      col.int('month', '月'),
      col.int('week_of_year', '年内周数'),
      col.int('day_of_week', '星期几: 1-7'),
      col.varchar('day_name', 10, '星期名称'),
      col.bool('is_weekend', '是否周末', 'false'),
      col.bool('is_holiday', '是否节假日', 'false'),
      col.varchar('holiday_name', 50, '节假日名称'),
      col.varchar('fiscal_quarter', 10, '财务季度'),
    ],
  },
  {
    name: 'dim_region',
    comment: '地区维度表',
    layer: 'dwd',
    columns: [
      col.id('地区维度ID'),
      col.varchar('province', 30, '省'),
      col.varchar('city', 30, '市'),
      col.varchar('district', 30, '区'),
      col.varchar('region_tier', 10, '城市等级: tier1/tier2/tier3/tier4/tier5'),
      col.varchar('economic_zone', 30, '经济区域: 长三角/珠三角/京津冀/其他'),
    ],
  },
  {
    name: 'dim_payment_method',
    comment: '支付方式维度表',
    layer: 'dwd',
    columns: [
      col.id('支付方式ID'),
      col.varchar('method_code', 20, '方式编码'),
      col.varchar('method_name', 30, '方式名称'),
      col.varchar('method_group', 20, '方式分组: third_party/bank/balance'),
    ],
  },
  {
    name: 'dim_promotion',
    comment: '活动维度表',
    layer: 'dwd',
    columns: [
      col.id('活动维度ID'),
      col.fk('promotion_id', 'ods_promotions', '来源活动ID'),
      col.varchar('promo_name', 100, '活动名称'),
      col.varchar('promo_type', 30, '活动类型'),
      col.timestamp('start_time', '开始时间'),
      col.timestamp('end_time', '结束时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_coupon',
    comment: '优惠券维度表',
    layer: 'dwd',
    columns: [
      col.id('优惠券维度ID'),
      col.fk('coupon_id', 'ods_coupons', '来源优惠券ID'),
      col.varchar('coupon_name', 100, '优惠券名称'),
      col.varchar('coupon_type', 20, '类型'),
      col.decimal('face_value', '10,2', '面值'),
      col.decimal('min_spend', '10,2', '最低消费'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'dim_logistics_company',
    comment: '物流公司维度表',
    layer: 'dwd',
    columns: [
      col.id('物流公司维度ID'),
      col.fk('company_id', 'ods_logistics_companies', '来源物流公司ID'),
      col.varchar('company_name', 50, '物流公司名称'),
      col.varchar('company_code', 20, '公司编码'),
    ],
  },
  {
    name: 'dim_category',
    comment: '类目维度表(扁平化)',
    layer: 'dwd',
    columns: [
      col.id('类目维度ID'),
      col.fk('category_id', 'ods_categories', '来源类目ID'),
      col.varchar('category_name', 100, '类目名称'),
      col.int('level', '层级'),
      col.varchar('l1_name', 100, '一级类目名称'),
      col.bigint('l1_id', '一级类目ID'),
      col.varchar('l2_name', 100, '二级类目名称'),
      col.bigint('l2_id', '二级类目ID'),
      col.varchar('l3_name', 100, '三级类目名称'),
      col.bigint('l3_id', '三级类目ID'),
      col.ds(),
      col.etlTime(),
    ],
  },

  // ── Fact Tables ──
  {
    name: 'fact_order',
    comment: '订单事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.varchar('order_no', 30, '订单号'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.varchar('order_source', 20, '订单来源'),
      col.status('订单状态', 'pending/paid/shipped/delivered/completed/cancelled'),
      col.decimal('total_amount', '12,2', '总金额'),
      col.decimal('discount_amount', '12,2', '优惠金额'),
      col.decimal('shipping_fee', '10,2', '运费'),
      col.decimal('pay_amount', '12,2', '实付金额'),
      col.int('item_count', '商品种类数'),
      col.int('total_qty', '商品总数量'),
      col.date('order_date', '下单日期'),
      col.timestamp('paid_at', '支付时间'),
      col.timestamp('shipped_at', '发货时间'),
      col.timestamp('delivered_at', '签收时间'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_order_item',
    comment: '订单明细事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('order_item_id', 'ods_order_items', '订单明细ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.fk('category_id', 'ods_categories', '类目ID'),
      col.fk('brand_id', 'ods_brands', '品牌ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.decimal('unit_price', '12,2', '下单单价'),
      col.int('quantity', '数量'),
      col.decimal('discount_amount', '12,2', '优惠分摊金额'),
      col.decimal('subtotal', '12,2', '小计'),
      col.decimal('cost_amount', '12,2', '成本金额'),
      col.decimal('gross_profit', '12,2', '毛利'),
      col.date('order_date', '下单日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_payment',
    comment: '支付事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('payment_id', 'ods_payments', '支付ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.decimal('amount', '12,2', '支付金额'),
      col.varchar('payment_method', 20, '支付方式'),
      col.status('支付状态', 'pending/success/failed/refunded'),
      col.date('pay_date', '支付日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_refund',
    comment: '退款事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('refund_id', 'ods_payment_refunds', '退款ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.decimal('refund_amount', '12,2', '退款金额'),
      col.varchar('refund_reason', 200, '退款原因'),
      col.status('退款状态', 'pending/processing/success/failed'),
      col.date('refund_date', '退款日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_cart_action',
    comment: '购物车行为事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.varchar('action', 20, '行为: add/remove/update_qty'),
      col.int('quantity', '数量'),
      col.decimal('unit_price', '12,2', '单价'),
      col.date('action_date', '行为日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_page_view',
    comment: '页面浏览事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('page_type', 30, '页面类型'),
      col.varchar('page_id', 50, '页面标识'),
      col.varchar('referrer_type', 30, '来源类型'),
      col.int('duration_sec', '停留时长(秒)'),
      col.varchar('device_type', 20, '设备类型'),
      col.date('view_date', '浏览日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_search',
    comment: '搜索事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('keyword', 200, '搜索关键词'),
      col.int('result_count', '结果数'),
      col.bool('has_click', '是否点击结果', 'false'),
      col.bool('has_purchase', '是否产生购买', 'false'),
      col.date('search_date', '搜索日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_click_event',
    comment: '点击行为事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('event_type', 30, '事件类型'),
      col.varchar('target_type', 20, '目标类型'),
      col.varchar('target_id', 50, '目标ID'),
      col.varchar('page_type', 30, '页面类型'),
      col.date('event_date', '事件日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_review',
    comment: '评价事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('review_id', 'ods_reviews', '评价ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.int('rating', '评分'),
      col.bool('has_image', '是否带图', 'false'),
      col.int('content_length', '评价字数'),
      col.int('like_count', '点赞数'),
      col.date('review_date', '评价日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_after_sale',
    comment: '售后事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('after_sale_id', 'ods_after_sales', '售后工单ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('type', 20, '售后类型'),
      col.varchar('reason', 200, '原因'),
      col.decimal('refund_amount', '12,2', '退款金额'),
      col.status('状态', 'submitted/processing/completed/rejected'),
      col.date('apply_date', '申请日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_shipment',
    comment: '发货物流事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('shipment_id', 'ods_shipments', '发货ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('logistics_company_id', 'ods_logistics_companies', '物流公司ID'),
      col.fk('warehouse_id', 'ods_warehouses', '发货仓ID'),
      col.int('delivery_days', '配送天数'),
      col.date('ship_date', '发货日期'),
      col.date('delivery_date', '签收日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_coupon_usage',
    comment: '优惠券使用事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_coupon_id', 'ods_user_coupons', '用户券记录ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('coupon_id', 'ods_coupons', '优惠券ID'),
      col.fk('order_id', 'ods_orders', '使用订单ID'),
      col.decimal('face_value', '10,2', '面值'),
      col.decimal('order_amount', '12,2', '订单金额'),
      col.decimal('discount_actual', '10,2', '实际优惠金额'),
      col.date('used_date', '使用日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_inventory_snapshot',
    comment: '库存快照事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('sku_id', 'ods_product_skus', 'SKU ID'),
      col.fk('warehouse_id', 'ods_warehouses', '仓库ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.int('available_qty', '可用库存'),
      col.int('locked_qty', '锁定库存'),
      col.int('total_qty', '总库存'),
      col.decimal('inventory_value', '14,2', '库存货值'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_login',
    comment: '登录事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('device_type', 30, '设备类型'),
      col.varchar('login_method', 20, '登录方式'),
      col.bool('login_success', '是否成功', 'true'),
      col.date('login_date', '登录日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_commission',
    comment: '佣金事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.decimal('order_amount', '12,2', '订单金额'),
      col.decimal('commission_rate', '5,4', '佣金比例'),
      col.decimal('commission_amount', '12,2', '佣金金额'),
      col.date('order_date', '订单日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_recommend',
    comment: '推荐事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.fk('product_id', 'ods_products', '推荐商品ID'),
      col.varchar('scene', 30, '推荐场景'),
      col.varchar('algorithm', 50, '算法'),
      col.int('position', '展示位置'),
      col.bool('is_clicked', '是否点击', 'false'),
      col.bool('is_purchased', '是否购买', 'false'),
      col.date('recommend_date', '推荐日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_live_stream',
    comment: '直播事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('live_stream_id', 'ods_live_streams', '直播ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.int('duration_min', '直播时长(分钟)'),
      col.int('peak_viewers', '最高在线'),
      col.int('total_viewers', '累计观看'),
      col.decimal('gmv', '14,2', '直播GMV'),
      col.int('product_count', '上架商品数'),
      col.date('stream_date', '直播日期'),
      col.ds(),
      col.etlTime(),
    ],
  },
  {
    name: 'fact_user_share',
    comment: '用户分享事实表',
    layer: 'dwd',
    columns: [
      col.id('事实ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('share_type', 20, '分享类型'),
      col.varchar('share_target_id', 50, '目标ID'),
      col.varchar('channel', 20, '渠道'),
      col.int('click_count', '点击次数'),
      col.date('share_date', '分享日期'),
      col.ds(),
      col.etlTime(),
    ],
  },

  // ── Bridge Tables ──
  {
    name: 'bridge_order_promotion',
    comment: '订单-活动桥接表(多对多)',
    layer: 'dwd',
    columns: [
      col.id('桥接ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('promotion_id', 'ods_promotions', '活动ID'),
      col.decimal('discount_amount', '12,2', '活动优惠金额'),
      col.ds(),
    ],
  },
  {
    name: 'bridge_order_coupon',
    comment: '订单-优惠券桥接表(多对多)',
    layer: 'dwd',
    columns: [
      col.id('桥接ID'),
      col.fk('order_id', 'ods_orders', '订单ID'),
      col.fk('coupon_id', 'ods_coupons', '优惠券ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.decimal('discount_amount', '12,2', '券优惠金额'),
      col.ds(),
    ],
  },
  {
    name: 'bridge_product_store',
    comment: '商品-店铺桥接表(多对多)',
    layer: 'dwd',
    columns: [
      col.id('桥接ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.fk('store_id', 'ods_stores', '店铺ID'),
      col.decimal('store_price', '12,2', '店铺价格'),
      col.bool('is_featured', '是否主推', 'false'),
      col.ds(),
    ],
  },
  {
    name: 'bridge_product_tag',
    comment: '商品-标签桥接表(多对多)',
    layer: 'dwd',
    columns: [
      col.id('桥接ID'),
      col.fk('product_id', 'ods_products', '商品ID'),
      col.varchar('tag_name', 50, '标签名称'),
      col.varchar('tag_type', 30, '标签类型'),
      col.ds(),
    ],
  },
  {
    name: 'bridge_user_segment',
    comment: '用户-分群桥接表(多对多)',
    layer: 'dwd',
    columns: [
      col.id('桥接ID'),
      col.fk('user_id', 'ods_users', '用户ID'),
      col.varchar('segment_code', 50, '分群编码'),
      col.varchar('segment_name', 100, '分群名称'),
      col.ds(),
    ],
  },
];

/* ──────────────────────────────────────────────
 * DWS Layer (~50 tables) — Pre-aggregated summary
 * ────────────────────────────────────────────── */

const commonUserDims = [{ name: 'user_id', comment: '用户ID' }];
const commonProductDims = [
  { name: 'product_id', comment: '商品ID' },
  { name: 'category_l1', comment: '一级类目' },
];
const commonStoreDims = [
  { name: 'store_id', comment: '店铺ID' },
  { name: 'store_name', comment: '店铺名称' },
];

const dwsTables: TableDef[] = [
  // ── User Aggregations ──
  generateSummaryTable(
    'dws',
    'user_daily_stats',
    '用户日粒度汇总表',
    'dws',
    [...commonUserDims],
    [
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'pay_amount', type: 'decimal', comment: '支付金额' },
      { name: 'item_count', type: 'bigint', comment: '购买商品数' },
      { name: 'page_view_count', type: 'bigint', comment: '页面浏览数' },
      { name: 'search_count', type: 'bigint', comment: '搜索次数' },
      { name: 'cart_add_count', type: 'bigint', comment: '加购次数' },
      { name: 'login_count', type: 'bigint', comment: '登录次数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'user_monthly_stats',
    '用户月粒度汇总表',
    'dws',
    [...commonUserDims, { name: 'month_key', comment: '月份YYYYMM' }],
    [
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'pay_amount', type: 'decimal', comment: '支付金额' },
      { name: 'refund_amount', type: 'decimal', comment: '退款金额' },
      { name: 'active_days', type: 'bigint', comment: '活跃天数' },
      { name: 'product_categories', type: 'bigint', comment: '购买类目数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'user_lifetime_stats',
    '用户累计汇总表',
    'dws',
    [...commonUserDims],
    [
      { name: 'total_orders', type: 'bigint', comment: '累计订单数' },
      { name: 'total_pay_amount', type: 'decimal', comment: '累计支付金额' },
      { name: 'total_refund_amount', type: 'decimal', comment: '累计退款金额' },
      { name: 'avg_order_amount', type: 'decimal', comment: '平均客单价' },
      { name: 'first_order_days', type: 'bigint', comment: '首单距今天数' },
      { name: 'last_order_days', type: 'bigint', comment: '最近下单距今天数' },
      { name: 'order_frequency', type: 'decimal', comment: '下单频率(次/月)' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'new_user_daily',
    '每日新用户汇总表',
    'dws',
    [{ name: 'register_source', comment: '注册来源' }],
    [
      { name: 'new_user_count', type: 'bigint', comment: '新注册用户数' },
      { name: 'first_order_count', type: 'bigint', comment: '首单转化数' },
      { name: 'first_order_amount', type: 'decimal', comment: '首单金额' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'user_retention_daily',
    '用户留存日汇总表',
    'dws',
    [{ name: 'cohort_date', comment: '注册日期' }],
    [
      { name: 'cohort_size', type: 'bigint', comment: '注册人数' },
      { name: 'retained_d1', type: 'bigint', comment: '次日留存人数' },
      { name: 'retained_d3', type: 'bigint', comment: '3日留存人数' },
      { name: 'retained_d7', type: 'bigint', comment: '7日留存人数' },
      { name: 'retained_d14', type: 'bigint', comment: '14日留存人数' },
      { name: 'retained_d30', type: 'bigint', comment: '30日留存人数' },
    ],
  ),

  // ── Product Aggregations ──
  generateSummaryTable(
    'dws',
    'product_daily_sales',
    '商品日销售汇总表',
    'dws',
    [...commonProductDims, { name: 'brand_name', comment: '品牌' }],
    [
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'sold_qty', type: 'bigint', comment: '销售数量' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'refund_qty', type: 'bigint', comment: '退款数量' },
      { name: 'refund_amount', type: 'decimal', comment: '退款金额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'product_monthly_sales',
    '商品月销售汇总表',
    'dws',
    [...commonProductDims, { name: 'month_key', comment: '月份' }],
    [
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'sold_qty', type: 'bigint', comment: '销售数量' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
      { name: 'review_count', type: 'bigint', comment: '评价数' },
      { name: 'avg_rating', type: 'decimal', comment: '平均评分' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'product_review_stats',
    '商品评价汇总表',
    'dws',
    [...commonProductDims],
    [
      { name: 'total_reviews', type: 'bigint', comment: '总评价数' },
      { name: 'avg_rating', type: 'decimal', comment: '平均评分' },
      { name: 'positive_count', type: 'bigint', comment: '好评数(4-5星)' },
      { name: 'neutral_count', type: 'bigint', comment: '中评数(3星)' },
      { name: 'negative_count', type: 'bigint', comment: '差评数(1-2星)' },
      { name: 'image_review_count', type: 'bigint', comment: '有图评价数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'sku_daily_sales',
    'SKU日销售汇总表',
    'dws',
    [
      { name: 'sku_id', comment: 'SKU ID' },
      { name: 'product_id', comment: '商品ID' },
    ],
    [
      { name: 'sold_qty', type: 'bigint', comment: '销售数量' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'refund_qty', type: 'bigint', comment: '退款数量' },
    ],
  ),

  // ── Category Aggregations ──
  generateSummaryTable(
    'dws',
    'category_daily_sales',
    '类目日销售汇总表',
    'dws',
    [
      { name: 'category_l1', comment: '一级类目' },
      { name: 'category_l2', comment: '二级类目' },
    ],
    [
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
      { name: 'product_count', type: 'bigint', comment: '动销商品数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'category_monthly_sales',
    '类目月销售汇总表',
    'dws',
    [
      { name: 'category_l1', comment: '一级类目' },
      { name: 'month_key', comment: '月份' },
    ],
    [
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'order_count', type: 'bigint', comment: '下单数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '均单价' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
    ],
  ),

  // ── Brand Aggregations ──
  generateSummaryTable(
    'dws',
    'brand_daily_sales',
    '品牌日销售汇总表',
    'dws',
    [
      { name: 'brand_id', comment: '品牌ID' },
      { name: 'brand_name', comment: '品牌名称' },
    ],
    [
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'sold_qty', type: 'bigint', comment: '销量' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'buyer_count', type: 'bigint', comment: '购买人数' },
    ],
  ),

  // ── Order Aggregations ──
  generateSummaryTable(
    'dws',
    'order_daily_summary',
    '订单日汇总表',
    'dws',
    [{ name: 'order_source', comment: '订单来源' }],
    [
      { name: 'total_orders', type: 'bigint', comment: '总订单数' },
      { name: 'paid_orders', type: 'bigint', comment: '已支付订单数' },
      { name: 'cancelled_orders', type: 'bigint', comment: '已取消订单数' },
      { name: 'total_amount', type: 'decimal', comment: '订单总金额' },
      { name: 'pay_amount', type: 'decimal', comment: '实付总金额' },
      { name: 'discount_amount', type: 'decimal', comment: '总优惠金额' },
      { name: 'shipping_fee', type: 'decimal', comment: '总运费' },
      { name: 'buyer_count', type: 'bigint', comment: '下单用户数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'order_hourly_distribution',
    '订单小时分布表',
    'dws',
    [{ name: 'hour_of_day', comment: '小时(0-23)' }],
    [
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'pay_amount', type: 'decimal', comment: '支付金额' },
    ],
  ),

  // ── Revenue Aggregations ──
  generateSummaryTable(
    'dws',
    'revenue_daily',
    '营收日汇总表',
    'dws',
    [],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV(下单口径)' },
      { name: 'net_revenue', type: 'decimal', comment: '净收入(扣退款)' },
      { name: 'cost', type: 'decimal', comment: '商品成本' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
      { name: 'discount_total', type: 'decimal', comment: '优惠总额' },
      { name: 'shipping_income', type: 'decimal', comment: '运费收入' },
      { name: 'refund_total', type: 'decimal', comment: '退款总额' },
      { name: 'commission_income', type: 'decimal', comment: '佣金收入' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'revenue_monthly',
    '营收月汇总表',
    'dws',
    [{ name: 'month_key', comment: '月份' }],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'net_revenue', type: 'decimal', comment: '净收入' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
      { name: 'gross_margin_rate', type: 'decimal', comment: '毛利率' },
    ],
  ),

  // ── Payment Aggregations ──
  generateSummaryTable(
    'dws',
    'payment_daily_summary',
    '支付日汇总表',
    'dws',
    [{ name: 'payment_method', comment: '支付方式' }],
    [
      { name: 'pay_count', type: 'bigint', comment: '支付笔数' },
      { name: 'pay_amount', type: 'decimal', comment: '支付金额' },
      { name: 'pay_user_count', type: 'bigint', comment: '支付用户数' },
    ],
  ),

  // ── Inventory Aggregations ──
  generateSummaryTable(
    'dws',
    'inventory_daily_snapshot',
    '库存日快照汇总表',
    'dws',
    [{ name: 'warehouse_id', comment: '仓库ID' }],
    [
      { name: 'total_sku_count', type: 'bigint', comment: '总SKU数' },
      { name: 'total_qty', type: 'bigint', comment: '总库存数量' },
      { name: 'available_qty', type: 'bigint', comment: '可用库存数量' },
      { name: 'locked_qty', type: 'bigint', comment: '锁定库存数量' },
      { name: 'inventory_value', type: 'decimal', comment: '库存总货值' },
      { name: 'alert_sku_count', type: 'bigint', comment: '预警SKU数' },
      { name: 'stockout_sku_count', type: 'bigint', comment: '缺货SKU数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'inventory_turnover_monthly',
    '库存周转月汇总表',
    'dws',
    [{ name: 'category_l1', comment: '一级类目' }],
    [
      { name: 'avg_inventory_value', type: 'decimal', comment: '平均库存货值' },
      { name: 'cogs', type: 'decimal', comment: '销售成本(COGS)' },
      { name: 'turnover_ratio', type: 'decimal', comment: '库存周转率' },
      { name: 'turnover_days', type: 'decimal', comment: '库存周转天数' },
    ],
  ),

  // ── Funnel Aggregations ──
  generateSummaryTable(
    'dws',
    'funnel_daily',
    '转化漏斗日汇总表',
    'dws',
    [{ name: 'platform', comment: '平台: app/web/h5' }],
    [
      { name: 'uv', type: 'bigint', comment: '访客数' },
      { name: 'product_view_uv', type: 'bigint', comment: '商品详情浏览UV' },
      { name: 'cart_add_uv', type: 'bigint', comment: '加购UV' },
      { name: 'checkout_uv', type: 'bigint', comment: '提交订单UV' },
      { name: 'pay_uv', type: 'bigint', comment: '支付成功UV' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'search_conversion_daily',
    '搜索转化日汇总表',
    'dws',
    [],
    [
      { name: 'search_count', type: 'bigint', comment: '搜索次数' },
      { name: 'search_user_count', type: 'bigint', comment: '搜索用户数' },
      { name: 'click_count', type: 'bigint', comment: '结果点击次数' },
      { name: 'purchase_count', type: 'bigint', comment: '搜索后购买次数' },
      { name: 'null_result_count', type: 'bigint', comment: '无结果搜索次数' },
    ],
  ),

  // ── Store Aggregations ──
  generateSummaryTable(
    'dws',
    'store_daily_sales',
    '店铺日销售汇总表',
    'dws',
    [...commonStoreDims],
    [
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'refund_amount', type: 'decimal', comment: '退款金额' },
      { name: 'commission_amount', type: 'decimal', comment: '佣金金额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'store_monthly_sales',
    '店铺月销售汇总表',
    'dws',
    [...commonStoreDims, { name: 'month_key', comment: '月份' }],
    [
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'net_amount', type: 'decimal', comment: '净销售额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
    ],
  ),

  // ── Promotion & Coupon Aggregations ──
  generateSummaryTable(
    'dws',
    'promotion_daily_stats',
    '活动日汇总表',
    'dws',
    [
      { name: 'promotion_id', comment: '活动ID' },
      { name: 'promo_type', comment: '活动类型' },
    ],
    [
      { name: 'order_count', type: 'bigint', comment: '活动订单数' },
      { name: 'sales_amount', type: 'decimal', comment: '活动销售额' },
      { name: 'discount_amount', type: 'decimal', comment: '优惠金额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'coupon_daily_stats',
    '优惠券日汇总表',
    'dws',
    [{ name: 'coupon_id', comment: '优惠券ID' }],
    [
      { name: 'issued_count', type: 'bigint', comment: '发放数' },
      { name: 'used_count', type: 'bigint', comment: '使用数' },
      { name: 'total_discount', type: 'decimal', comment: '优惠总金额' },
      { name: 'order_amount', type: 'decimal', comment: '带券订单金额' },
    ],
  ),

  // ── Logistics Aggregations ──
  generateSummaryTable(
    'dws',
    'logistics_daily_stats',
    '物流日汇总表',
    'dws',
    [{ name: 'logistics_company', comment: '物流公司' }],
    [
      { name: 'shipment_count', type: 'bigint', comment: '发货数' },
      { name: 'delivered_count', type: 'bigint', comment: '妥投数' },
      { name: 'avg_delivery_days', type: 'decimal', comment: '平均配送天数' },
      { name: 'exception_count', type: 'bigint', comment: '异常件数' },
    ],
  ),

  // ── After-Sales & Refund Aggregations ──
  generateSummaryTable(
    'dws',
    'refund_daily_stats',
    '退款日汇总表',
    'dws',
    [],
    [
      { name: 'refund_count', type: 'bigint', comment: '退款笔数' },
      { name: 'refund_amount', type: 'decimal', comment: '退款金额' },
      { name: 'refund_user_count', type: 'bigint', comment: '退款用户数' },
      { name: 'return_count', type: 'bigint', comment: '退货数' },
      { name: 'exchange_count', type: 'bigint', comment: '换货数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'after_sale_reason_stats',
    '售后原因汇总表',
    'dws',
    [{ name: 'reason_category', comment: '原因分类' }],
    [
      { name: 'case_count', type: 'bigint', comment: '工单数' },
      { name: 'refund_amount', type: 'decimal', comment: '退款金额' },
    ],
  ),

  // ── Regional Aggregations ──
  generateSummaryTable(
    'dws',
    'region_daily_sales',
    '地区日销售汇总表',
    'dws',
    [
      { name: 'province', comment: '省' },
      { name: 'city', comment: '市' },
    ],
    [
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'buyer_count', type: 'bigint', comment: '购买用户数' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'region_monthly_sales',
    '地区月销售汇总表',
    'dws',
    [
      { name: 'province', comment: '省' },
      { name: 'month_key', comment: '月份' },
    ],
    [
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'new_buyer_count', type: 'bigint', comment: '新客数' },
    ],
  ),

  // ── Live Stream & Content Aggregations ──
  generateSummaryTable(
    'dws',
    'live_stream_daily_stats',
    '直播日汇总表',
    'dws',
    [],
    [
      { name: 'stream_count', type: 'bigint', comment: '直播场次' },
      { name: 'total_viewers', type: 'bigint', comment: '总观看人数' },
      { name: 'gmv', type: 'decimal', comment: '直播GMV' },
      { name: 'product_sold_qty', type: 'bigint', comment: '售出商品数' },
    ],
  ),

  // ── Recommendation Aggregations ──
  generateSummaryTable(
    'dws',
    'recommend_daily_stats',
    '推荐日汇总表',
    'dws',
    [
      { name: 'scene', comment: '推荐场景' },
      { name: 'algorithm', comment: '推荐算法' },
    ],
    [
      { name: 'expose_count', type: 'bigint', comment: '曝光数' },
      { name: 'click_count', type: 'bigint', comment: '点击数' },
      { name: 'purchase_count', type: 'bigint', comment: '购买数' },
      { name: 'ctr', type: 'decimal', comment: '点击率' },
      { name: 'cvr', type: 'decimal', comment: '购买转化率' },
    ],
  ),

  // ── Device & Platform Aggregations ──
  generateSummaryTable(
    'dws',
    'device_daily_stats',
    '设备日活跃汇总表',
    'dws',
    [
      { name: 'device_type', comment: '设备类型' },
      { name: 'app_version', comment: 'APP版本' },
    ],
    [
      { name: 'dau', type: 'bigint', comment: '日活用户数' },
      { name: 'session_count', type: 'bigint', comment: '会话数' },
      { name: 'avg_duration_sec', type: 'decimal', comment: '平均使用时长(秒)' },
      { name: 'crash_count', type: 'bigint', comment: '崩溃数' },
    ],
  ),

  // ── Group Buy & Flash Sale Aggregations ──
  generateSummaryTable(
    'dws',
    'group_buy_daily_stats',
    '拼团日汇总表',
    'dws',
    [],
    [
      { name: 'initiated_groups', type: 'bigint', comment: '发起团数' },
      { name: 'success_groups', type: 'bigint', comment: '成团数' },
      { name: 'participant_count', type: 'bigint', comment: '参团人数' },
      { name: 'gmv', type: 'decimal', comment: '拼团GMV' },
    ],
  ),
  generateSummaryTable(
    'dws',
    'flash_sale_daily_stats',
    '秒杀日汇总表',
    'dws',
    [],
    [
      { name: 'item_count', type: 'bigint', comment: '秒杀商品数' },
      { name: 'sold_qty', type: 'bigint', comment: '售出数量' },
      { name: 'gmv', type: 'decimal', comment: '秒杀GMV' },
      { name: 'sellout_rate', type: 'decimal', comment: '售罄率' },
    ],
  ),

  // ── Push & Notification Aggregations ──
  generateSummaryTable(
    'dws',
    'push_daily_stats',
    '推送日汇总表',
    'dws',
    [{ name: 'channel', comment: '推送渠道' }],
    [
      { name: 'sent_count', type: 'bigint', comment: '发送数' },
      { name: 'delivered_count', type: 'bigint', comment: '到达数' },
      { name: 'read_count', type: 'bigint', comment: '已读数' },
      { name: 'click_count', type: 'bigint', comment: '点击数' },
    ],
  ),

  // ── Payment Method Trend ──
  generateSummaryTable(
    'dws',
    'payment_method_monthly',
    '支付方式月趋势表',
    'dws',
    [
      { name: 'payment_method', comment: '支付方式' },
      { name: 'month_key', comment: '月份' },
    ],
    [
      { name: 'pay_count', type: 'bigint', comment: '支付笔数' },
      { name: 'pay_amount', type: 'decimal', comment: '支付金额' },
      { name: 'user_count', type: 'bigint', comment: '用户数' },
    ],
  ),
];

/* ──────────────────────────────────────────────
 * ADS Layer (~40 tables) — Application-facing
 * ────────────────────────────────────────────── */

const adsTables: TableDef[] = [
  // ── Dashboard Overview ──
  generateSummaryTable(
    'ads',
    'dashboard_realtime',
    '实时大盘监控表',
    'ads',
    [],
    [
      { name: 'gmv_today', type: 'decimal', comment: '今日GMV' },
      { name: 'order_count_today', type: 'bigint', comment: '今日订单数' },
      { name: 'pay_user_count_today', type: 'bigint', comment: '今日支付用户数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
      { name: 'refund_amount_today', type: 'decimal', comment: '今日退款额' },
      { name: 'dau', type: 'bigint', comment: '日活跃用户数' },
      { name: 'new_user_count', type: 'bigint', comment: '新注册用户数' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'dashboard_daily_trend',
    '大盘日趋势表',
    'ads',
    [],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'net_revenue', type: 'decimal', comment: '净收入' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'pay_user_count', type: 'bigint', comment: '支付用户数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
      { name: 'refund_rate', type: 'decimal', comment: '退款率' },
      { name: 'dau', type: 'bigint', comment: 'DAU' },
      { name: 'new_user_count', type: 'bigint', comment: '新用户数' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'dashboard_weekly_report',
    '大盘周报表',
    'ads',
    [{ name: 'week_start', comment: '周起始日期' }],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'gmv_wow', type: 'decimal', comment: 'GMV环比增长率' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'pay_user_count', type: 'bigint', comment: '支付用户数' },
      { name: 'new_user_count', type: 'bigint', comment: '新用户数' },
      { name: 'retention_rate_d7', type: 'decimal', comment: '7日留存率' },
    ],
  ),

  // ── User Portraits & Segmentation ──
  generateSummaryTable(
    'ads',
    'user_portrait',
    '用户画像宽表',
    'ads',
    [
      { name: 'user_id', comment: '用户ID' },
      { name: 'gender', comment: '性别' },
      { name: 'age_group', comment: '年龄段' },
      { name: 'city_tier', comment: '城市等级' },
      { name: 'membership_level', comment: '会员等级' },
      { name: 'lifecycle_stage', comment: '生命周期阶段' },
    ],
    [
      { name: 'rfm_score', type: 'decimal', comment: 'RFM综合分' },
      { name: 'recency_score', type: 'bigint', comment: 'R-最近购买分' },
      { name: 'frequency_score', type: 'bigint', comment: 'F-购买频率分' },
      { name: 'monetary_score', type: 'bigint', comment: 'M-消费金额分' },
      { name: 'clv_predicted', type: 'decimal', comment: '预测CLV' },
      { name: 'churn_probability', type: 'decimal', comment: '流失概率' },
      { name: 'preferred_category', type: 'bigint', comment: '偏好品类数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '平均客单价' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'user_segment_summary',
    '用户分群汇总表',
    'ads',
    [
      { name: 'segment_code', comment: '分群编码' },
      { name: 'segment_name', comment: '分群名称' },
    ],
    [
      { name: 'user_count', type: 'bigint', comment: '用户数' },
      { name: 'active_user_count', type: 'bigint', comment: '活跃用户数' },
      { name: 'total_gmv', type: 'decimal', comment: '贡献GMV' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
      { name: 'repurchase_rate', type: 'decimal', comment: '复购率' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'user_value_distribution',
    '用户价值分布表',
    'ads',
    [{ name: 'value_tier', comment: '价值层级: S/A/B/C/D' }],
    [
      { name: 'user_count', type: 'bigint', comment: '用户数' },
      { name: 'user_pct', type: 'decimal', comment: '用户占比' },
      { name: 'gmv_contribution', type: 'decimal', comment: 'GMV贡献' },
      { name: 'gmv_pct', type: 'decimal', comment: 'GMV占比' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'user_churn_warning',
    '用户流失预警表',
    'ads',
    [{ name: 'user_id', comment: '用户ID' }],
    [
      { name: 'days_since_last_order', type: 'bigint', comment: '距上次下单天数' },
      { name: 'days_since_last_login', type: 'bigint', comment: '距上次登录天数' },
      { name: 'churn_probability', type: 'decimal', comment: '流失概率' },
      { name: 'historical_order_count', type: 'bigint', comment: '历史订单数' },
      { name: 'historical_pay_amount', type: 'decimal', comment: '历史消费金额' },
    ],
  ),

  // ── Product Analysis ──
  generateSummaryTable(
    'ads',
    'product_ranking',
    '商品销量排行榜表',
    'ads',
    [
      { name: 'product_id', comment: '商品ID' },
      { name: 'product_name', comment: '商品名称' },
      { name: 'category_l1', comment: '一级类目' },
      { name: 'brand_name', comment: '品牌' },
    ],
    [
      { name: 'rank_overall', type: 'bigint', comment: '综合排名' },
      { name: 'sales_amount', type: 'decimal', comment: '销售金额' },
      { name: 'sold_qty', type: 'bigint', comment: '销量' },
      { name: 'buyer_count', type: 'bigint', comment: '购买人数' },
      { name: 'avg_rating', type: 'decimal', comment: '平均评分' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'product_recommend_pool',
    '商品推荐候选池表',
    'ads',
    [
      { name: 'product_id', comment: '商品ID' },
      { name: 'scene', comment: '推荐场景' },
    ],
    [
      { name: 'score', type: 'decimal', comment: '推荐分' },
      { name: 'ctr_predicted', type: 'decimal', comment: '预测CTR' },
      { name: 'cvr_predicted', type: 'decimal', comment: '预测CVR' },
      { name: 'recent_sales', type: 'bigint', comment: '近7日销量' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'product_opportunity',
    '商品机会洞察表',
    'ads',
    [
      { name: 'product_id', comment: '商品ID' },
      { name: 'category_l1', comment: '一级类目' },
    ],
    [
      { name: 'view_to_cart_rate', type: 'decimal', comment: '浏览-加购转化率' },
      { name: 'cart_to_pay_rate', type: 'decimal', comment: '加购-支付转化率' },
      { name: 'repurchase_rate', type: 'decimal', comment: '复购率' },
      { name: 'return_rate', type: 'decimal', comment: '退货率' },
    ],
  ),

  // ── Marketing ROI ──
  generateSummaryTable(
    'ads',
    'marketing_roi_daily',
    '营销ROI日报表',
    'ads',
    [
      { name: 'channel', comment: '营销渠道' },
      { name: 'campaign_id', comment: '活动ID' },
    ],
    [
      { name: 'cost', type: 'decimal', comment: '投入成本' },
      { name: 'revenue', type: 'decimal', comment: '带来收入' },
      { name: 'roi', type: 'decimal', comment: 'ROI' },
      { name: 'new_user_acquired', type: 'bigint', comment: '获客数' },
      { name: 'cac', type: 'decimal', comment: '获客成本' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'coupon_effectiveness',
    '优惠券效果分析表',
    'ads',
    [
      { name: 'coupon_id', comment: '优惠券ID' },
      { name: 'coupon_name', comment: '优惠券名称' },
    ],
    [
      { name: 'issued_count', type: 'bigint', comment: '发放数' },
      { name: 'claimed_count', type: 'bigint', comment: '领取数' },
      { name: 'used_count', type: 'bigint', comment: '使用数' },
      { name: 'claim_rate', type: 'decimal', comment: '领取率' },
      { name: 'use_rate', type: 'decimal', comment: '核销率' },
      { name: 'incremental_gmv', type: 'decimal', comment: '增量GMV' },
      { name: 'roi', type: 'decimal', comment: '券ROI' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'promotion_effectiveness',
    '活动效果分析表',
    'ads',
    [
      { name: 'promotion_id', comment: '活动ID' },
      { name: 'promo_name', comment: '活动名称' },
    ],
    [
      { name: 'participant_count', type: 'bigint', comment: '参与用户数' },
      { name: 'order_count', type: 'bigint', comment: '活动订单数' },
      { name: 'gmv', type: 'decimal', comment: '活动GMV' },
      { name: 'discount_total', type: 'decimal', comment: '优惠总额' },
      { name: 'incremental_gmv', type: 'decimal', comment: '增量GMV' },
      { name: 'roi', type: 'decimal', comment: '活动ROI' },
    ],
  ),

  // ── Forecast & Prediction ──
  generateSummaryTable(
    'ads',
    'sales_forecast_daily',
    '销售预测表',
    'ads',
    [{ name: 'forecast_date', comment: '预测日期' }],
    [
      { name: 'predicted_gmv', type: 'decimal', comment: '预测GMV' },
      { name: 'predicted_order_count', type: 'bigint', comment: '预测订单数' },
      { name: 'confidence_lower', type: 'decimal', comment: '置信区间下限' },
      { name: 'confidence_upper', type: 'decimal', comment: '置信区间上限' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'inventory_replenish_plan',
    '补货计划建议表',
    'ads',
    [
      { name: 'sku_id', comment: 'SKU ID' },
      { name: 'warehouse_id', comment: '仓库ID' },
    ],
    [
      { name: 'current_stock', type: 'bigint', comment: '当前库存' },
      { name: 'predicted_demand_7d', type: 'bigint', comment: '未来7日预测需求' },
      { name: 'predicted_demand_30d', type: 'bigint', comment: '未来30日预测需求' },
      { name: 'suggested_qty', type: 'bigint', comment: '建议补货数量' },
      { name: 'stockout_risk', type: 'decimal', comment: '缺货风险指数' },
    ],
  ),

  // ── Reports ──
  generateSummaryTable(
    'ads',
    'category_performance_report',
    '类目经营报表',
    'ads',
    [
      { name: 'category_l1', comment: '一级类目' },
      { name: 'category_l2', comment: '二级类目' },
    ],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
      { name: 'gross_margin', type: 'decimal', comment: '毛利率' },
      { name: 'active_product_rate', type: 'decimal', comment: '动销率' },
      { name: 'return_rate', type: 'decimal', comment: '退货率' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'brand_performance_report',
    '品牌经营报表',
    'ads',
    [
      { name: 'brand_id', comment: '品牌ID' },
      { name: 'brand_name', comment: '品牌名称' },
    ],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'sold_qty', type: 'bigint', comment: '销量' },
      { name: 'market_share', type: 'decimal', comment: '市占率' },
      { name: 'avg_rating', type: 'decimal', comment: '平均评分' },
      { name: 'return_rate', type: 'decimal', comment: '退货率' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'store_performance_report',
    '店铺经营报表',
    'ads',
    [...commonStoreDims, { name: 'store_type', comment: '店铺类型' }],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'buyer_count', type: 'bigint', comment: '买家数' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
      { name: 'refund_rate', type: 'decimal', comment: '退款率' },
      { name: 'avg_delivery_days', type: 'decimal', comment: '平均发货天数' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'regional_sales_report',
    '地区销售报表',
    'ads',
    [
      { name: 'province', comment: '省' },
      { name: 'city', comment: '市' },
      { name: 'city_tier', comment: '城市等级' },
    ],
    [
      { name: 'gmv', type: 'decimal', comment: 'GMV' },
      { name: 'order_count', type: 'bigint', comment: '订单数' },
      { name: 'buyer_count', type: 'bigint', comment: '买家数' },
      { name: 'new_buyer_count', type: 'bigint', comment: '新客数' },
      { name: 'per_capita_spend', type: 'decimal', comment: '人均消费' },
    ],
  ),

  // ── Operational KPIs ──
  generateSummaryTable(
    'ads',
    'customer_service_kpi',
    '客服运营KPI表',
    'ads',
    [],
    [
      { name: 'ticket_count', type: 'bigint', comment: '工单数' },
      { name: 'avg_response_time_min', type: 'decimal', comment: '平均首响时间(分钟)' },
      { name: 'avg_resolution_time_hour', type: 'decimal', comment: '平均解决时长(小时)' },
      { name: 'satisfaction_rate', type: 'decimal', comment: '满意度' },
      { name: 'one_touch_resolution_rate', type: 'decimal', comment: '一次解决率' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'logistics_kpi_report',
    '物流KPI报表',
    'ads',
    [{ name: 'logistics_company', comment: '物流公司' }],
    [
      { name: 'on_time_rate', type: 'decimal', comment: '准时妥投率' },
      { name: 'avg_delivery_days', type: 'decimal', comment: '平均配送天数' },
      { name: 'damage_rate', type: 'decimal', comment: '破损率' },
      { name: 'complaint_rate', type: 'decimal', comment: '投诉率' },
    ],
  ),

  // ── Traffic & Conversion ──
  generateSummaryTable(
    'ads',
    'traffic_source_report',
    '流量来源报表',
    'ads',
    [
      { name: 'traffic_source', comment: '流量来源' },
      { name: 'campaign_name', comment: '活动名称' },
    ],
    [
      { name: 'uv', type: 'bigint', comment: 'UV' },
      { name: 'pv', type: 'bigint', comment: 'PV' },
      { name: 'bounce_rate', type: 'decimal', comment: '跳出率' },
      { name: 'conversion_rate', type: 'decimal', comment: '转化率' },
      { name: 'gmv', type: 'decimal', comment: '贡献GMV' },
    ],
  ),
  generateSummaryTable(
    'ads',
    'conversion_funnel_report',
    '转化漏斗分析报表',
    'ads',
    [{ name: 'platform', comment: '平台' }],
    [
      { name: 'visit_uv', type: 'bigint', comment: '访问UV' },
      { name: 'view_uv', type: 'bigint', comment: '浏览UV' },
      { name: 'cart_uv', type: 'bigint', comment: '加购UV' },
      { name: 'order_uv', type: 'bigint', comment: '下单UV' },
      { name: 'pay_uv', type: 'bigint', comment: '支付UV' },
      { name: 'visit_to_view_rate', type: 'decimal', comment: '访问-浏览转化率' },
      { name: 'view_to_cart_rate', type: 'decimal', comment: '浏览-加购转化率' },
      { name: 'cart_to_order_rate', type: 'decimal', comment: '加购-下单转化率' },
      { name: 'order_to_pay_rate', type: 'decimal', comment: '下单-支付转化率' },
    ],
  ),

  // ── AB Test ──
  generateSummaryTable(
    'ads',
    'ab_test_result',
    'AB实验结果表',
    'ads',
    [
      { name: 'experiment_id', comment: '实验ID' },
      { name: 'variant', comment: '实验组: control/treatment' },
    ],
    [
      { name: 'sample_size', type: 'bigint', comment: '样本量' },
      { name: 'conversion_rate', type: 'decimal', comment: '转化率' },
      { name: 'avg_revenue', type: 'decimal', comment: '人均收入' },
      { name: 'p_value', type: 'decimal', comment: 'p值' },
      { name: 'lift', type: 'decimal', comment: '提升比例' },
    ],
  ),

  // ── Live Stream Report ──
  generateSummaryTable(
    'ads',
    'live_stream_performance',
    '直播业绩报表',
    'ads',
    [
      { name: 'store_id', comment: '店铺ID' },
      { name: 'anchor_name', comment: '主播' },
    ],
    [
      { name: 'stream_count', type: 'bigint', comment: '直播场次' },
      { name: 'total_viewers', type: 'bigint', comment: '总观看' },
      { name: 'gmv', type: 'decimal', comment: '直播GMV' },
      { name: 'avg_gmv_per_stream', type: 'decimal', comment: '场均GMV' },
      { name: 'conversion_rate', type: 'decimal', comment: '转化率' },
    ],
  ),

  // ── Membership Analysis ──
  generateSummaryTable(
    'ads',
    'membership_analysis',
    '会员分析报表',
    'ads',
    [{ name: 'membership_level', comment: '会员等级' }],
    [
      { name: 'member_count', type: 'bigint', comment: '会员数' },
      { name: 'active_count', type: 'bigint', comment: '活跃会员数' },
      { name: 'gmv_contribution', type: 'decimal', comment: 'GMV贡献' },
      { name: 'avg_order_amount', type: 'decimal', comment: '客单价' },
      { name: 'repurchase_rate', type: 'decimal', comment: '复购率' },
      { name: 'point_usage_rate', type: 'decimal', comment: '积分使用率' },
    ],
  ),

  // ── Search Analysis ──
  generateSummaryTable(
    'ads',
    'search_keyword_report',
    '搜索关键词分析表',
    'ads',
    [{ name: 'keyword', comment: '搜索关键词' }],
    [
      { name: 'search_count', type: 'bigint', comment: '搜索次数' },
      { name: 'click_through_rate', type: 'decimal', comment: '点击率' },
      { name: 'conversion_rate', type: 'decimal', comment: '转化率' },
      { name: 'null_result_rate', type: 'decimal', comment: '无结果率' },
      { name: 'associated_gmv', type: 'decimal', comment: '关联GMV' },
    ],
  ),

  // ── Financial Summary ──
  generateSummaryTable(
    'ads',
    'finance_monthly_summary',
    '财务月度汇总表',
    'ads',
    [{ name: 'month_key', comment: '月份' }],
    [
      { name: 'total_gmv', type: 'decimal', comment: '总GMV' },
      { name: 'net_revenue', type: 'decimal', comment: '净收入' },
      { name: 'cogs', type: 'decimal', comment: '商品成本' },
      { name: 'gross_profit', type: 'decimal', comment: '毛利' },
      { name: 'gross_margin', type: 'decimal', comment: '毛利率' },
      { name: 'marketing_cost', type: 'decimal', comment: '营销费用' },
      { name: 'logistics_cost', type: 'decimal', comment: '物流费用' },
      { name: 'commission_income', type: 'decimal', comment: '佣金收入' },
    ],
  ),
];

/* ──────────────────────────────────────────────
 * Metrics
 * ────────────────────────────────────────────── */

const metrics: DomainDefinition['metrics'] = [
  {
    name: 'gmv',
    displayName: 'GMV',
    expression: 'SUM(total_amount)',
    metricType: 'atomic',
    sourceTable: 'fact_order',
    filters: [{ column: 'status', op: '!=', value: 'cancelled' }],
    dimensions: ['order_date', 'order_source', 'store_id'],
    granularity: ['day', 'week', 'month'],
    format: 'currency',
    description: '下单口径的商品交易总额，不含已取消订单',
  },
  {
    name: 'order_count',
    displayName: '订单量',
    expression: 'COUNT(DISTINCT order_id)',
    metricType: 'atomic',
    sourceTable: 'fact_order',
    dimensions: ['order_date', 'order_source'],
    granularity: ['day', 'week', 'month'],
    format: 'number',
    description: '去重订单数',
  },
  {
    name: 'aov',
    displayName: '客单价(AOV)',
    expression: 'SUM(pay_amount) / NULLIF(COUNT(DISTINCT order_id), 0)',
    metricType: 'derived',
    sourceTable: 'fact_order',
    filters: [{ column: 'status', op: 'NOT IN', value: "('cancelled')" }],
    dimensions: ['order_date'],
    granularity: ['day', 'week', 'month'],
    format: 'currency',
    description: '实付金额 / 去重订单数',
  },
  {
    name: 'paying_users',
    displayName: '支付用户数',
    expression: 'COUNT(DISTINCT user_id)',
    metricType: 'atomic',
    sourceTable: 'fact_payment',
    filters: [{ column: 'status', op: '=', value: 'success' }],
    dimensions: ['pay_date', 'payment_method'],
    granularity: ['day', 'week', 'month'],
    format: 'number',
    description: '支付成功的去重用户数',
  },
  {
    name: 'arpu',
    displayName: 'ARPU',
    expression: 'SUM(pay_amount) / NULLIF(COUNT(DISTINCT user_id), 0)',
    metricType: 'derived',
    sourceTable: 'fact_order',
    filters: [{ column: 'status', op: 'NOT IN', value: "('cancelled')" }],
    dimensions: ['order_date'],
    granularity: ['month'],
    format: 'currency',
    description: '每活跃用户平均收入 = 实付金额 / 支付用户数',
  },
  {
    name: 'refund_rate',
    displayName: '退款率',
    expression: 'SUM(refund_amount) / NULLIF(SUM(pay_amount), 0)',
    metricType: 'composite',
    sourceTable: 'dws_refund_daily_stats',
    dimensions: ['ds'],
    granularity: ['day', 'week', 'month'],
    format: 'percentage',
    description: '退款金额 / 实付金额',
  },
  {
    name: 'cart_conversion_rate',
    displayName: '加购转化率',
    expression: 'pay_uv::DECIMAL / NULLIF(cart_add_uv, 0)',
    metricType: 'derived',
    sourceTable: 'dws_funnel_daily',
    dimensions: ['platform', 'ds'],
    granularity: ['day', 'week'],
    format: 'percentage',
    description: '支付UV / 加购UV',
  },
  {
    name: 'dau',
    displayName: 'DAU',
    expression: 'COUNT(DISTINCT user_id)',
    metricType: 'atomic',
    sourceTable: 'fact_login',
    filters: [{ column: 'login_success', op: '=', value: 'true' }],
    dimensions: ['login_date', 'device_type'],
    granularity: ['day'],
    format: 'number',
    description: '日活跃用户数(成功登录去重)',
  },
  {
    name: 'retention_7d',
    displayName: '7日留存率',
    expression: 'retained_d7::DECIMAL / NULLIF(cohort_size, 0)',
    metricType: 'derived',
    sourceTable: 'dws_user_retention_daily',
    dimensions: ['cohort_date'],
    granularity: ['day'],
    format: 'percentage',
    description: '注册后第7天仍活跃的用户比例',
  },
  {
    name: 'inventory_turnover',
    displayName: '库存周转率',
    expression: 'cogs / NULLIF(avg_inventory_value, 0)',
    metricType: 'derived',
    sourceTable: 'dws_inventory_turnover_monthly',
    dimensions: ['category_l1'],
    granularity: ['month'],
    format: 'number',
    description: '销售成本 / 平均库存货值，衡量库存流转效率',
  },
];

/* ──────────────────────────────────────────────
 * Glossary
 * ────────────────────────────────────────────── */

const glossary: DomainDefinition['glossary'] = [
  {
    term: '活跃用户',
    sqlExpression:
      'COUNT(DISTINCT user_id) FROM fact_login WHERE login_success = true AND login_date = CURRENT_DATE',
    description: '当日成功登录过平台的去重用户，包含APP、Web、H5、小程序等全渠道',
  },
  {
    term: '新用户',
    sqlExpression: 'COUNT(*) FROM ods_users WHERE DATE(created_at) = CURRENT_DATE',
    description: '当天完成注册的用户，以注册时间为准。首日注册且下单则同时统计为新客首单',
  },
  {
    term: '高价值用户',
    sqlExpression:
      "COUNT(*) FROM ads_user_portrait WHERE rfm_score >= 4.0 AND lifecycle_stage = 'active'",
    description: 'RFM综合评分 >= 4.0 且处于活跃生命周期阶段的用户，是运营重点维护对象',
  },
  {
    term: '复购率',
    sqlExpression:
      'COUNT(DISTINCT CASE WHEN total_orders >= 2 THEN user_id END)::DECIMAL / NULLIF(COUNT(DISTINCT user_id), 0) FROM dws_user_lifetime_stats',
    description: '统计周期内下单>=2次的用户占全部下单用户的比例，衡量用户粘性',
  },
  {
    term: '客单价',
    sqlExpression:
      "SUM(pay_amount) / NULLIF(COUNT(DISTINCT order_id), 0) FROM fact_order WHERE status != 'cancelled'",
    description: '实付金额除以去重订单数，反映每单平均消费水平，不含已取消订单',
  },
  {
    term: '退款率',
    sqlExpression:
      'SUM(refund_amount)::DECIMAL / NULLIF(SUM(pay_amount), 0) FROM dws_revenue_daily',
    description: '退款金额占实付金额的比例，退款率过高表示商品质量或服务可能存在问题',
  },
  {
    term: '连带率',
    sqlExpression:
      "SUM(total_qty)::DECIMAL / NULLIF(COUNT(DISTINCT order_id), 0) FROM fact_order WHERE status != 'cancelled'",
    description: '平均每笔订单购买的商品件数，反映关联销售能力。连带率>1.5为优秀',
  },
  {
    term: '动销率',
    sqlExpression:
      'COUNT(DISTINCT CASE WHEN sold_qty > 0 THEN product_id END)::DECIMAL / NULLIF(COUNT(DISTINCT product_id), 0) FROM dws_product_daily_sales',
    description:
      '有销量的商品数占全部上架商品数的比例，衡量商品结构健康度。动销率低意味着大量商品无人购买',
  },
  {
    term: 'GMV',
    sqlExpression: "SUM(total_amount) FROM fact_order WHERE status != 'cancelled'",
    description:
      '商品交易总额(Gross Merchandise Volume)，下单口径，含未支付订单，不含取消订单。是衡量平台规模的核心指标',
  },
  {
    term: '毛利率',
    sqlExpression: 'SUM(gross_profit)::DECIMAL / NULLIF(SUM(subtotal), 0) FROM fact_order_item',
    description: '(销售收入-商品成本)/销售收入，衡量商品盈利能力。毛利率低于20%需关注成本控制',
  },
];

/* ──────────────────────────────────────────────
 * Knowledge Docs
 * ────────────────────────────────────────────── */

const knowledgeDocs: DomainDefinition['knowledgeDocs'] = [
  {
    title: '电商业务指标体系规范',
    docType: 'document',
    content: `# 电商业务指标体系规范

## 1. 核心指标定义

### 1.1 交易指标
- **GMV (Gross Merchandise Volume)**：下单口径的商品交易总额。包含已支付和未支付（不含已取消）订单金额。
  - 计算公式：SUM(total_amount) WHERE status != 'cancelled'
  - 统计口径：按下单时间归属，不按支付时间
- **净收入 (Net Revenue)**：扣除退款后的实际收入
  - 计算公式：SUM(pay_amount) - SUM(refund_amount)
- **客单价 (AOV)**：SUM(pay_amount) / COUNT(DISTINCT order_id)
- **ARPU**：月度实付金额 / 月度支付用户数

### 1.2 用户指标
- **DAU**：日活跃用户数，以登录成功为准
- **MAU**：月活跃用户数，当月至少登录1次
- **新客首单转化率**：注册30天内完成首单的用户比例
- **7日留存率**：注册第7天仍有登录行为的用户占注册总人数的比例

### 1.3 商品指标
- **动销率**：有销量的SKU数 / 总上架SKU数
- **库存周转率**：销售成本(COGS) / 平均库存货值，按月计算
- **退货率**：退货订单数 / 总完成订单数

## 2. 统计口径约定

### 2.1 时间口径
- 日数据：自然日 00:00:00 ~ 23:59:59
- 周数据：周一 00:00:00 ~ 周日 23:59:59
- 月数据：自然月1号 ~ 月末
- 实时数据：延迟 <= 5分钟

### 2.2 状态过滤
- GMV 统计需排除 status = 'cancelled'
- 支付用户统计需 payment.status = 'success'
- 退款统计以退款成功时间为准

### 2.3 去重规则
- 用户数：按 user_id 去重
- 订单数：按 order_id 去重
- 商品数：按 product_id 或 sku_id 去重（视场景）`,
  },
  {
    title: '数据仓库分层架构规范',
    docType: 'document',
    content: `# 数据仓库分层架构规范

## 1. 分层概览

| 层级 | 前缀 | 职责 | 更新频率 |
|------|------|------|----------|
| ODS | ods_ | 原始数据落地，保持源系统结构 | 实时/T+1 |
| DWD | dim_/fact_ | 维度建模，数据清洗标准化 | T+1 |
| DWS | dws_ | 预聚合汇总，降低查询成本 | T+1 |
| ADS | ads_ | 面向应用和报表的宽表 | T+1/按需 |

## 2. 各层规范

### 2.1 ODS 层
- 保持源系统字段和粒度不变
- 增加 created_at、updated_at 审计字段
- 命名：ods_{业务域}_{实体} (如 ods_orders, ods_users)

### 2.2 DWD 层
- **维度表(dim_)**：缓慢变化维度(SCD Type 2)，保留历史版本
- **事实表(fact_)**：按业务事件建模，保留最细粒度
- **桥接表(bridge_)**：处理多对多关系
- 所有事实表必须包含 ds 分区字段和 etl_time

### 2.3 DWS 层
- 按主题域和时间粒度预聚合
- 命名：dws_{主题}_{时间粒度}_{描述} (如 dws_user_daily_stats)
- 必须包含 ds 分区字段

### 2.4 ADS 层
- 直接面向报表和应用
- 可包含跨主题域的宽表
- 命名：ads_{应用场景}_{描述} (如 ads_dashboard_realtime)

## 3. 数据质量
- 每层 ETL 必须做 NOT NULL 校验、唯一性校验、值域校验
- 层间数据量级校验：DWD 层记录数应与 ODS 层一致或可解释差异
- 关键指标设置波动报警（日环比变化超过 20% 告警）`,
  },
];

/* ──────────────────────────────────────────────
 * Conversations
 * ────────────────────────────────────────────── */

const conversations: DomainDefinition['conversations'] = [
  {
    title: 'GMV分析多轮对话',
    messages: [
      {
        role: 'user',
        content: '帮我看下最近7天的GMV趋势',
      },
      {
        role: 'assistant',
        content: '最近7天GMV数据如下，其中周末两天有明显下降：',
        sql: `SELECT ds,
       gmv,
       net_revenue,
       order_count,
       ROUND(gmv - LAG(gmv) OVER (ORDER BY ds), 2) AS gmv_change
FROM dws_revenue_daily
WHERE ds >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY ds`,
        confidence: 0.95,
      },
      {
        role: 'user',
        content: '按一级类目拆开看看，哪个类目贡献最大',
      },
      {
        role: 'assistant',
        content: '按一级类目的GMV分布和排名：',
        sql: `SELECT d.category_l1,
       SUM(f.subtotal) AS gmv,
       COUNT(DISTINCT f.order_id) AS order_count,
       COUNT(DISTINCT f.user_id) AS buyer_count,
       ROUND(SUM(f.subtotal) * 100.0 / SUM(SUM(f.subtotal)) OVER (), 2) AS gmv_pct
FROM fact_order_item f
JOIN dim_product d ON f.product_id = d.product_id
JOIN fact_order o ON f.order_id = o.order_id
WHERE o.ds >= CURRENT_DATE - INTERVAL '7 days'
  AND o.status != 'cancelled'
GROUP BY d.category_l1
ORDER BY gmv DESC`,
        confidence: 0.92,
      },
      {
        role: 'user',
        content: '对比上周同期呢',
      },
      {
        role: 'assistant',
        content: 'GMV同比上周同期对比：',
        sql: `WITH this_week AS (
  SELECT ds, gmv FROM dws_revenue_daily
  WHERE ds >= CURRENT_DATE - INTERVAL '7 days'
),
last_week AS (
  SELECT ds + INTERVAL '7 days' AS ds_aligned, gmv
  FROM dws_revenue_daily
  WHERE ds >= CURRENT_DATE - INTERVAL '14 days'
    AND ds < CURRENT_DATE - INTERVAL '7 days'
)
SELECT t.ds,
       t.gmv AS this_week_gmv,
       l.gmv AS last_week_gmv,
       ROUND((t.gmv - l.gmv) / NULLIF(l.gmv, 0) * 100, 2) AS wow_pct
FROM this_week t
LEFT JOIN last_week l ON t.ds = l.ds_aligned
ORDER BY t.ds`,
        confidence: 0.9,
      },
    ],
  },
  {
    title: '用户留存分析对话',
    messages: [
      {
        role: 'user',
        content: '最近一个月的新用户7日留存率怎么样',
      },
      {
        role: 'assistant',
        content: '近30天注册用户的7日留存趋势：',
        sql: `SELECT cohort_date,
       cohort_size,
       retained_d7,
       ROUND(retained_d7::DECIMAL / NULLIF(cohort_size, 0) * 100, 2) AS retention_rate_d7
FROM dws_user_retention_daily
WHERE ds >= CURRENT_DATE - INTERVAL '30 days'
  AND ds <= CURRENT_DATE - INTERVAL '7 days'
ORDER BY cohort_date`,
        confidence: 0.93,
      },
      {
        role: 'user',
        content: '按注册来源拆分一下',
      },
      {
        role: 'assistant',
        content: '按注册来源分组的7日留存率对比：',
        sql: `SELECT u.register_source,
       COUNT(DISTINCT u.id) AS cohort_size,
       COUNT(DISTINCT CASE
         WHEN l.login_date = DATE(u.created_at) + INTERVAL '7 days'
         THEN u.id END) AS retained_d7,
       ROUND(
         COUNT(DISTINCT CASE
           WHEN l.login_date = DATE(u.created_at) + INTERVAL '7 days'
           THEN u.id END)::DECIMAL
         / NULLIF(COUNT(DISTINCT u.id), 0) * 100, 2
       ) AS retention_rate_d7
FROM ods_users u
LEFT JOIN fact_login l ON u.id = l.user_id
WHERE u.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND u.created_at < CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.register_source
ORDER BY retention_rate_d7 DESC`,
        confidence: 0.88,
      },
    ],
  },
];

/* ──────────────────────────────────────────────
 * Query History
 * ────────────────────────────────────────────── */

const queryHistory: DomainDefinition['queryHistory'] = [
  {
    naturalLanguage: '今天的GMV和订单量分别是多少',
    generatedSql: `SELECT
  SUM(total_amount) AS gmv,
  COUNT(DISTINCT order_id) AS order_count,
  COUNT(DISTINCT user_id) AS paying_users
FROM fact_order
WHERE ds = CURRENT_DATE
  AND status != 'cancelled'`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['fact_order'],
  },
  {
    naturalLanguage: '上个月各品牌的销售额排行TOP10',
    generatedSql: `SELECT
  d.brand_name,
  SUM(f.subtotal) AS sales_amount,
  SUM(f.quantity) AS sold_qty,
  COUNT(DISTINCT f.user_id) AS buyer_count
FROM fact_order_item f
JOIN dim_product d ON f.product_id = d.product_id
WHERE f.ds >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND f.ds < DATE_TRUNC('month', CURRENT_DATE)
GROUP BY d.brand_name
ORDER BY sales_amount DESC
LIMIT 10`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['fact_order_item', 'dim_product'],
  },
  {
    naturalLanguage: '最近30天退款率超过10%的商品有哪些',
    generatedSql: `SELECT
  p.product_name,
  p.category_l1,
  SUM(s.sales_amount) AS sales_amount,
  SUM(s.refund_amount) AS refund_amount,
  ROUND(SUM(s.refund_amount) / NULLIF(SUM(s.sales_amount), 0) * 100, 2) AS refund_rate_pct
FROM dws_product_daily_sales s
JOIN dim_product p ON s.product_id = p.product_id
WHERE s.ds >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.product_name, p.category_l1
HAVING SUM(s.refund_amount) / NULLIF(SUM(s.sales_amount), 0) > 0.10
ORDER BY refund_rate_pct DESC`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['dws_product_daily_sales', 'dim_product'],
  },
  {
    naturalLanguage: '本月各渠道转化漏斗数据',
    generatedSql: `SELECT
  platform,
  SUM(uv) AS total_uv,
  SUM(product_view_uv) AS view_uv,
  SUM(cart_add_uv) AS cart_uv,
  SUM(checkout_uv) AS order_uv,
  SUM(pay_uv) AS pay_uv,
  ROUND(SUM(pay_uv)::DECIMAL / NULLIF(SUM(uv), 0) * 100, 2) AS overall_cvr_pct
FROM dws_funnel_daily
WHERE ds >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY platform
ORDER BY total_uv DESC`,
    status: 'accepted',
    isGolden: true,
    tablesUsed: ['dws_funnel_daily'],
  },
  {
    naturalLanguage: '高价值用户的复购率和客单价',
    generatedSql: `SELECT
  p.lifecycle_stage,
  COUNT(*) AS user_count,
  ROUND(AVG(p.avg_order_amount), 2) AS avg_order_amount,
  ROUND(
    COUNT(CASE WHEN l.total_orders >= 2 THEN 1 END)::DECIMAL
    / NULLIF(COUNT(*), 0) * 100, 2
  ) AS repurchase_rate_pct
FROM ads_user_portrait p
JOIN dws_user_lifetime_stats l ON p.user_id = l.user_id
WHERE p.rfm_score >= 4.0
GROUP BY p.lifecycle_stage
ORDER BY repurchase_rate_pct DESC`,
    status: 'accepted',
    isGolden: false,
    tablesUsed: ['ads_user_portrait', 'dws_user_lifetime_stats'],
  },
];

/* ──────────────────────────────────────────────
 * Domain Export
 * ────────────────────────────────────────────── */

const allTables = [...odsTables, ...dwdTables, ...dwsTables, ...adsTables];

export const ecommerceDomain: DomainDefinition = {
  name: '电商交易分析',
  description:
    '覆盖电商平台全链路的数据仓库模型，包含用户、商品、订单、支付、物流、营销、库存等核心业务域。' +
    '支持从 ODS 原始层到 ADS 应用层的完整分析场景，涵盖 GMV 分析、用户画像、转化漏斗、营销 ROI 等典型电商数据分析需求。',
  dialect: 'postgresql',
  tables: allTables,
  metrics,
  glossary,
  knowledgeDocs,
  conversations,
  queryHistory,
};
