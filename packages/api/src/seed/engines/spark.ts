import type { EngineSeedDefinition, TableDef, MetricDef, GlossaryDef } from './types.js';

/* ═══════════════════════════════════════════════════════════════
 * Spark Engine Seed — DWS/ADS 计算密集型，覆盖聚合计算 + 应用层
 * 4 domains: trade, user, product, risk
 * 50 tables: DWS(20) + ADS(15) + DWD(10) + DIM(5)
 * ═══════════════════════════════════════════════════════════════ */

/* ─── Helper: shorthand column factories (Spark types) ─── */

function pk(comment: string) {
  return { name: 'id', dataType: 'BIGINT', comment, isPrimaryKey: true } as const;
}

function bigint(name: string, comment: string, opts: { referencesTable?: string; referencesColumn?: string } = {}) {
  return { name, dataType: 'BIGINT', comment, ...opts };
}

function str(name: string, comment: string) {
  return { name, dataType: 'STRING', comment };
}

function decimal(name: string, comment: string) {
  return { name, dataType: 'DECIMAL(18,2)', comment };
}

function ts(name: string, comment: string) {
  return { name, dataType: 'TIMESTAMP', comment };
}

function int(name: string, comment: string) {
  return { name, dataType: 'INT', comment };
}

function dbl(name: string, comment: string) {
  return { name, dataType: 'DOUBLE', comment };
}

function bool(name: string, comment: string) {
  return { name, dataType: 'BOOLEAN', comment };
}

function date(name: string, comment: string) {
  return { name, dataType: 'DATE', comment };
}

function arr(name: string, comment: string) {
  return { name, dataType: 'ARRAY<STRING>', comment };
}

function map(name: string, comment: string) {
  return { name, dataType: 'MAP<STRING,STRING>', comment };
}

function fk(name: string, refTable: string, comment: string) {
  return { name, dataType: 'BIGINT', comment, isNullable: false, referencesTable: refTable, referencesColumn: 'id' };
}

function ds() {
  return { name: 'ds', dataType: 'DATE', comment: '数据分区日期', isNullable: false };
}

function etl() {
  return { name: 'etl_time', dataType: 'TIMESTAMP', comment: 'ETL 处理时间' };
}

/* ══════════════════════════════════════════════════
 * DWS Layer — 20 tables (聚合计算)
 * ══════════════════════════════════════════════════ */

const dwsTables: TableDef[] = [
  /* ── Trade Domain ── */
  {
    name: 'dws_trade_hourly_stats',
    comment: '交易小时级汇总统计',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      int('hour', '小时(0-23)'),
      str('channel', '交易渠道'),
      bigint('order_cnt', '订单数'),
      decimal('gmv', '交易总额'),
      decimal('avg_order_amount', '客单价'),
      bigint('pay_user_cnt', '付款用户数'),
      decimal('refund_amount', '退款金额'),
      int('refund_cnt', '退款单数'),
      dbl('pay_conversion_rate', '支付转化率'),
      etl(),
    ],
  },
  {
    name: 'dws_trade_seller_1d',
    comment: '商家维度日交易汇总',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('seller_id', '商家ID'),
      str('seller_name', '商家名称'),
      bigint('order_cnt', '订单量'),
      decimal('gmv', '成交额'),
      bigint('pay_user_cnt', '付款买家数'),
      decimal('avg_delivery_hours', '平均发货时长(小时)'),
      dbl('positive_rate', '好评率'),
      int('dispute_cnt', '纠纷单数'),
      etl(),
    ],
  },
  {
    name: 'dws_trade_category_7d',
    comment: '品类维度7日交易汇总',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('category_id', '品类ID'),
      str('category_name', '品类名称'),
      bigint('order_cnt', '7日订单数'),
      decimal('gmv_7d', '7日成交额'),
      decimal('gmv_7d_wow', '成交额周环比'),
      bigint('buyer_cnt', '购买人数'),
      dbl('return_rate', '退货率'),
      etl(),
    ],
  },
  {
    name: 'dws_trade_payment_funnel_1d',
    comment: '交易支付漏斗日统计',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      str('platform', '平台: app/web/h5'),
      bigint('cart_add_cnt', '加购次数'),
      bigint('checkout_cnt', '提交订单数'),
      bigint('pay_attempt_cnt', '发起支付数'),
      bigint('pay_success_cnt', '支付成功数'),
      dbl('cart_to_checkout_rate', '加购到下单转化率'),
      dbl('checkout_to_pay_rate', '下单到支付转化率'),
      etl(),
    ],
  },
  {
    name: 'dws_trade_coupon_effect_1d',
    comment: '优惠券效果日统计',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('coupon_id', '优惠券ID'),
      str('coupon_name', '优惠券名称'),
      bigint('distribute_cnt', '发放数量'),
      bigint('use_cnt', '使用数量'),
      dbl('use_rate', '核销率'),
      decimal('discount_amount', '优惠总金额'),
      decimal('incremental_gmv', '带动增量GMV'),
      dbl('roi', '投入产出比'),
      etl(),
    ],
  },

  {
    name: 'dws_trade_cross_sell_affinity_7d',
    comment: '交叉销售亲和度7日统计',
    layer: 'dws',
    domain: 'trade',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('product_a_id', '商品A ID'),
      bigint('product_b_id', '商品B ID'),
      bigint('co_purchase_cnt', '共同购买次数'),
      dbl('lift_ratio', '提升度'),
      dbl('confidence', '置信度'),
      dbl('support', '支持度'),
      int('rule_rank', '关联规则排名'),
      etl(),
    ],
  },

  /* ── User Domain ── */
  {
    name: 'dws_user_funnel_1d',
    comment: '用户行为漏斗日统计',
    layer: 'dws',
    domain: 'user',
    columns: [
      pk('统计ID'),
      ds(),
      str('channel', '渠道来源'),
      bigint('visit_uv', '访问UV'),
      bigint('search_uv', '搜索UV'),
      bigint('detail_uv', '详情页UV'),
      bigint('cart_uv', '加购UV'),
      bigint('order_uv', '下单UV'),
      bigint('pay_uv', '支付UV'),
      dbl('visit_to_pay_rate', '访问到支付转化率'),
      etl(),
    ],
  },
  {
    name: 'dws_user_retention_nd',
    comment: '用户N日留存统计',
    layer: 'dws',
    domain: 'user',
    columns: [
      pk('统计ID'),
      ds(),
      str('cohort_date', '注册日期'),
      str('user_source', '用户来源渠道'),
      bigint('cohort_size', '同期群人数'),
      bigint('retain_1d', '次日留存人数'),
      bigint('retain_7d', '7日留存人数'),
      bigint('retain_30d', '30日留存人数'),
      dbl('retain_1d_rate', '次日留存率'),
      dbl('retain_7d_rate', '7日留存率'),
      dbl('retain_30d_rate', '30日留存率'),
      etl(),
    ],
  },
  {
    name: 'dws_user_value_segment_1d',
    comment: '用户价值分层日快照',
    layer: 'dws',
    domain: 'user',
    columns: [
      pk('统计ID'),
      ds(),
      str('value_segment', '价值分层: high/medium/low/dormant'),
      bigint('user_cnt', '用户数'),
      decimal('avg_arpu', '平均ARPU'),
      decimal('total_gmv', '累计成交额'),
      dbl('churn_prob_avg', '平均流失概率'),
      int('avg_order_frequency', '平均订单频次'),
      etl(),
    ],
  },
  {
    name: 'dws_user_lifecycle_1d',
    comment: '用户生命周期日统计',
    layer: 'dws',
    domain: 'user',
    columns: [
      pk('统计ID'),
      ds(),
      str('lifecycle_stage', '生命周期阶段: new/active/mature/decline/churn'),
      bigint('user_cnt', '用户数'),
      bigint('stage_inflow', '本期流入人数'),
      bigint('stage_outflow', '本期流出人数'),
      decimal('avg_lifetime_value', '平均LTV'),
      dbl('stage_transition_rate', '阶段转化率'),
      etl(),
    ],
  },
  {
    name: 'dws_user_activity_1d',
    comment: '用户活跃度日统计',
    layer: 'dws',
    domain: 'user',
    columns: [
      pk('统计ID'),
      ds(),
      str('platform', '平台'),
      bigint('dau', '日活用户数'),
      bigint('new_user_cnt', '新增用户数'),
      dbl('avg_session_duration', '平均会话时长(秒)'),
      dbl('avg_page_views', '平均浏览页数'),
      bigint('bounce_cnt', '跳出用户数'),
      dbl('bounce_rate', '跳出率'),
      etl(),
    ],
  },

  /* ── Product Domain ── */
  {
    name: 'dws_product_recommendation_score',
    comment: '商品推荐评分表',
    layer: 'dws',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('product_id', '商品ID'),
      bigint('user_segment_id', '用户分群ID'),
      dbl('cf_score', '协同过滤得分'),
      dbl('content_score', '内容相似度得分'),
      dbl('popularity_score', '热度得分'),
      dbl('final_score', '综合推荐分'),
      int('rank_in_segment', '分群内排名'),
      str('model_version', '模型版本号'),
      etl(),
    ],
  },
  {
    name: 'dws_product_sales_1d',
    comment: '商品销售日汇总',
    layer: 'dws',
    domain: 'product',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('product_id', '商品ID'),
      str('product_name', '商品名称'),
      bigint('sale_cnt', '销量'),
      decimal('sale_amount', '销售额'),
      bigint('visitor_cnt', '访客数'),
      dbl('conversion_rate', '转化率'),
      int('stock_remain', '剩余库存'),
      dbl('stock_turnover', '库存周转率'),
      etl(),
    ],
  },
  {
    name: 'dws_product_review_agg_1d',
    comment: '商品评价聚合日统计',
    layer: 'dws',
    domain: 'product',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('product_id', '商品ID'),
      bigint('review_cnt', '评价总数'),
      bigint('positive_cnt', '好评数'),
      bigint('negative_cnt', '差评数'),
      dbl('avg_rating', '平均评分'),
      dbl('sentiment_score', 'NLP情感得分'),
      arr('top_keywords', '高频关键词列表'),
      etl(),
    ],
  },
  {
    name: 'dws_product_search_rank_1d',
    comment: '商品搜索排名日统计',
    layer: 'dws',
    domain: 'product',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('product_id', '商品ID'),
      str('keyword', '搜索关键词'),
      bigint('impression_cnt', '曝光次数'),
      bigint('click_cnt', '点击次数'),
      dbl('ctr', '点击率'),
      int('avg_rank_position', '平均排名位置'),
      decimal('bid_price', '竞价单价'),
      etl(),
    ],
  },
  {
    name: 'dws_product_inventory_snapshot_1d',
    comment: '商品库存日快照',
    layer: 'dws',
    domain: 'product',
    columns: [
      pk('快照ID'),
      ds(),
      bigint('product_id', '商品ID'),
      bigint('warehouse_id', '仓库ID'),
      int('stock_qty', '库存数量'),
      int('locked_qty', '锁定数量'),
      int('available_qty', '可用数量'),
      int('inbound_qty_1d', '当日入库量'),
      int('outbound_qty_1d', '当日出库量'),
      dbl('stockout_probability', '缺货概率预测'),
      etl(),
    ],
  },

  /* ── Risk Domain ── */
  {
    name: 'dws_risk_model_output_1d',
    comment: '风控模型输出日汇总',
    layer: 'dws',
    domain: 'risk',
    columns: [
      pk('统计ID'),
      ds(),
      str('model_name', '模型名称'),
      str('model_version', '模型版本'),
      bigint('score_cnt', '评分次数'),
      dbl('avg_risk_score', '平均风险分'),
      bigint('high_risk_cnt', '高风险标记数'),
      dbl('precision_rate', '精确率'),
      dbl('recall_rate', '召回率'),
      dbl('f1_score', 'F1分数'),
      etl(),
    ],
  },
  {
    name: 'dws_risk_transaction_monitor_1h',
    comment: '交易风控小时级监控',
    layer: 'dws',
    domain: 'risk',
    columns: [
      pk('统计ID'),
      ds(),
      int('hour', '小时'),
      bigint('total_txn_cnt', '交易总笔数'),
      bigint('flagged_cnt', '标记异常笔数'),
      bigint('blocked_cnt', '拦截笔数'),
      decimal('blocked_amount', '拦截金额'),
      dbl('false_positive_rate', '误报率'),
      dbl('avg_response_ms', '平均响应耗时(ms)'),
      etl(),
    ],
  },
  {
    name: 'dws_risk_rule_hit_1d',
    comment: '风控规则命中日统计',
    layer: 'dws',
    domain: 'risk',
    columns: [
      pk('统计ID'),
      ds(),
      str('rule_id', '规则ID'),
      str('rule_name', '规则名称'),
      str('rule_category', '规则类别: fraud/aml/credit'),
      bigint('trigger_cnt', '触发次数'),
      bigint('block_cnt', '拦截次数'),
      dbl('hit_rate', '命中率'),
      dbl('effectiveness_score', '有效性评分'),
      etl(),
    ],
  },
  {
    name: 'dws_risk_user_portrait_1d',
    comment: '用户风险画像日快照',
    layer: 'dws',
    domain: 'risk',
    columns: [
      pk('统计ID'),
      ds(),
      bigint('user_id', '用户ID'),
      dbl('credit_score', '信用评分'),
      str('risk_level', '风险等级: low/medium/high/critical'),
      int('historical_violation_cnt', '历史违规次数'),
      decimal('max_single_txn_amount', '最大单笔交易额'),
      dbl('velocity_score', '交易频率异常分'),
      map('risk_tags', '风险标签键值对'),
      ts('last_risk_event_time', '最近风险事件时间'),
      etl(),
    ],
  },
];

/* ══════════════════════════════════════════════════
 * ADS Layer — 15 tables (应用层指标)
 * ══════════════════════════════════════════════════ */

const adsTables: TableDef[] = [
  /* ── Trade Domain ── */
  {
    name: 'ads_trade_realtime_gmv',
    comment: '实时GMV大盘看板',
    layer: 'ads',
    domain: 'trade',
    columns: [
      pk('记录ID'),
      ds(),
      ts('stat_time', '统计时间(分钟级)'),
      decimal('gmv_realtime', '实时累计GMV'),
      decimal('gmv_target', '当日GMV目标'),
      dbl('completion_rate', '目标完成率'),
      decimal('gmv_yoy', 'GMV同比值'),
      decimal('gmv_mom', 'GMV环比值'),
      bigint('order_cnt_realtime', '实时订单数'),
      bigint('pay_user_cnt', '付款人数'),
      etl(),
    ],
  },
  {
    name: 'ads_trade_regional_ranking',
    comment: '区域交易排行榜',
    layer: 'ads',
    domain: 'trade',
    columns: [
      pk('记录ID'),
      ds(),
      str('region_code', '区域编码'),
      str('region_name', '区域名称'),
      decimal('gmv', '成交额'),
      bigint('order_cnt', '订单数'),
      bigint('buyer_cnt', '买家数'),
      int('ranking', '排名'),
      dbl('gmv_growth_rate', 'GMV增长率'),
      etl(),
    ],
  },
  {
    name: 'ads_trade_anomaly_detection',
    comment: '交易异常检测结果',
    layer: 'ads',
    domain: 'trade',
    columns: [
      pk('记录ID'),
      ds(),
      ts('detect_time', '检测时间'),
      str('anomaly_type', '异常类型: spike/drop/pattern'),
      str('metric_name', '异常指标名'),
      dbl('expected_value', '预期值'),
      dbl('actual_value', '实际值'),
      dbl('deviation_pct', '偏差百分比'),
      str('severity', '严重程度: info/warning/critical'),
      bool('is_acknowledged', '是否已确认'),
      etl(),
    ],
  },
  {
    name: 'ads_trade_settlement_report',
    comment: '交易结算日报',
    layer: 'ads',
    domain: 'trade',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('seller_id', '商家ID'),
      decimal('total_settled', '结算总额'),
      decimal('commission_amount', '佣金金额'),
      decimal('platform_fee', '平台服务费'),
      decimal('net_payout', '净打款金额'),
      int('settled_order_cnt', '结算订单数'),
      str('settlement_status', '结算状态: pending/processing/done'),
      etl(),
    ],
  },

  /* ── User Domain ── */
  {
    name: 'ads_user_churn_prediction',
    comment: '用户流失预测结果',
    layer: 'ads',
    domain: 'user',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('user_id', '用户ID'),
      dbl('churn_probability', '流失概率'),
      str('churn_risk_level', '流失风险等级: low/medium/high'),
      str('top_churn_reason', '主要流失原因'),
      int('days_since_last_active', '距离最后活跃天数'),
      decimal('predicted_ltv_loss', '预计LTV损失'),
      str('recommended_action', '推荐挽回策略'),
      str('model_version', '模型版本'),
      etl(),
    ],
  },
  {
    name: 'ads_user_segmentation_output',
    comment: '用户分群结果表',
    layer: 'ads',
    domain: 'user',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('user_id', '用户ID'),
      str('segment_id', '分群ID'),
      str('segment_name', '分群名称'),
      dbl('segment_score', '分群置信度得分'),
      arr('feature_vector', '特征向量'),
      str('cluster_method', '聚类算法: kmeans/dbscan/gmm'),
      ts('assigned_at', '分群时间'),
      etl(),
    ],
  },
  {
    name: 'ads_user_realtime_profile',
    comment: '用户实时画像宽表',
    layer: 'ads',
    domain: 'user',
    columns: [
      pk('记录ID'),
      bigint('user_id', '用户ID'),
      str('gender', '性别'),
      str('age_band', '年龄段'),
      str('city_tier', '城市等级'),
      decimal('total_spent_30d', '近30日消费金额'),
      int('order_cnt_30d', '近30日订单数'),
      str('preferred_category', '偏好品类'),
      dbl('price_sensitivity', '价格敏感度'),
      arr('interest_tags', '兴趣标签列表'),
      ts('profile_updated_at', '画像更新时间'),
      etl(),
    ],
  },

  /* ── Product Domain ── */
  {
    name: 'ads_product_ab_test_result',
    comment: 'A/B测试实验结果',
    layer: 'ads',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      fk('experiment_id', 'dim_ab_test_config', '实验ID'),
      str('variant_name', '实验组名称: control/treatment'),
      bigint('sample_size', '样本量'),
      dbl('metric_value', '核心指标值'),
      dbl('lift_pct', '提升百分比'),
      dbl('p_value', 'P值'),
      dbl('confidence_interval_lower', '置信区间下界'),
      dbl('confidence_interval_upper', '置信区间上界'),
      bool('is_significant', '是否统计显著'),
      etl(),
    ],
  },
  {
    name: 'ads_product_trending_realtime',
    comment: '商品实时热销榜单',
    layer: 'ads',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ts('stat_time', '统计时间'),
      bigint('product_id', '商品ID'),
      str('product_name', '商品名称'),
      bigint('sale_cnt_1h', '近1小时销量'),
      decimal('sale_amount_1h', '近1小时销售额'),
      int('rank_position', '榜单排名'),
      dbl('trend_velocity', '趋势加速度'),
      str('category_name', '品类名称'),
      etl(),
    ],
  },
  {
    name: 'ads_product_price_elasticity',
    comment: '商品价格弹性分析',
    layer: 'ads',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('product_id', '商品ID'),
      decimal('current_price', '当前售价'),
      decimal('optimal_price', '最优定价'),
      dbl('price_elasticity', '价格弹性系数'),
      dbl('demand_curve_slope', '需求曲线斜率'),
      decimal('projected_revenue_uplift', '预计收入提升'),
      str('pricing_recommendation', '定价建议: raise/hold/lower'),
      str('model_version', '模型版本'),
      etl(),
    ],
  },
  {
    name: 'ads_product_supply_demand_forecast',
    comment: '商品供需预测报表',
    layer: 'ads',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('product_id', '商品ID'),
      int('forecast_horizon_days', '预测时间跨度(天)'),
      bigint('predicted_demand', '预测需求量'),
      bigint('current_supply', '当前供应量'),
      dbl('supply_demand_ratio', '供需比'),
      str('risk_flag', '风险标记: surplus/balanced/shortage'),
      dbl('forecast_confidence', '预测置信度'),
      etl(),
    ],
  },

  /* ── Risk Domain ── */
  {
    name: 'ads_risk_alert_summary',
    comment: '风控告警汇总看板',
    layer: 'ads',
    domain: 'risk',
    columns: [
      pk('记录ID'),
      ds(),
      str('alert_level', '告警级别: P0/P1/P2/P3'),
      str('alert_category', '告警类别'),
      bigint('alert_cnt', '告警数量'),
      bigint('resolved_cnt', '已处理数量'),
      dbl('resolve_rate', '处理率'),
      dbl('avg_resolve_minutes', '平均处理时长(分钟)'),
      bigint('false_positive_cnt', '误报数量'),
      decimal('total_loss_prevented', '挽回损失金额'),
      etl(),
    ],
  },
  {
    name: 'ads_risk_fraud_case_report',
    comment: '欺诈案件分析报告',
    layer: 'ads',
    domain: 'risk',
    columns: [
      pk('记录ID'),
      ds(),
      str('fraud_type', '欺诈类型: account_takeover/payment_fraud/promo_abuse'),
      bigint('case_cnt', '案件数'),
      decimal('total_fraud_amount', '涉案总金额'),
      decimal('recovered_amount', '追回金额'),
      dbl('recovery_rate', '追回率'),
      dbl('detection_accuracy', '检测准确率'),
      str('top_attack_vector', '主要攻击向量'),
      etl(),
    ],
  },
  {
    name: 'ads_risk_compliance_dashboard',
    comment: '合规监控仪表盘',
    layer: 'ads',
    domain: 'risk',
    columns: [
      pk('记录ID'),
      ds(),
      str('regulation_type', '法规类型: aml/kyc/data_privacy'),
      bigint('total_checks', '检查总数'),
      bigint('violation_cnt', '违规数'),
      dbl('compliance_rate', '合规率'),
      str('highest_severity_violation', '最高严重级别违规'),
      int('overdue_remediation_cnt', '逾期未修复数'),
      ts('last_audit_time', '最近审计时间'),
      etl(),
    ],
  },
  {
    name: 'ads_risk_model_performance_tracker',
    comment: '风控模型性能追踪',
    layer: 'ads',
    domain: 'risk',
    columns: [
      pk('记录ID'),
      ds(),
      fk('model_id', 'dim_model_version', '模型ID'),
      str('model_name', '模型名称'),
      dbl('auc_roc', 'AUC-ROC'),
      dbl('precision_at_k', 'Precision@K'),
      dbl('recall_at_k', 'Recall@K'),
      dbl('feature_drift_score', '特征漂移分数'),
      dbl('prediction_latency_p99_ms', 'P99推理延迟(ms)'),
      bool('requires_retrain', '是否需要重训练'),
      str('model_version', '模型版本'),
      etl(),
    ],
  },
];

/* ══════════════════════════════════════════════════
 * DWD Layer — 10 tables (明细加工层)
 * ══════════════════════════════════════════════════ */

const dwdTables: TableDef[] = [
  /* ── Trade Domain ── */
  {
    name: 'dwd_trade_order_enriched_di',
    comment: '订单明细加工日增量(已关联商品/用户/地域)',
    layer: 'dwd',
    domain: 'trade',
    columns: [
      pk('订单ID'),
      ds(),
      bigint('user_id', '用户ID'),
      bigint('product_id', '商品ID'),
      bigint('seller_id', '商家ID'),
      str('order_status', '订单状态: created/paid/shipped/completed/cancelled'),
      decimal('order_amount', '订单金额'),
      decimal('discount_amount', '优惠金额'),
      decimal('actual_pay_amount', '实付金额'),
      str('pay_method', '支付方式'),
      str('province', '收货省份'),
      str('city', '收货城市'),
      ts('order_time', '下单时间'),
      ts('pay_time', '支付时间'),
      etl(),
    ],
  },
  {
    name: 'dwd_trade_refund_di',
    comment: '退款明细日增量',
    layer: 'dwd',
    domain: 'trade',
    columns: [
      pk('退款ID'),
      ds(),
      fk('order_id', 'dwd_trade_order_enriched_di', '关联订单ID'),
      bigint('user_id', '用户ID'),
      str('refund_reason', '退款原因'),
      str('refund_type', '退款类型: refund_only/return_refund'),
      decimal('refund_amount', '退款金额'),
      str('refund_status', '退款状态: pending/approved/rejected/completed'),
      ts('apply_time', '申请时间'),
      ts('complete_time', '完成时间'),
      etl(),
    ],
  },
  {
    name: 'dwd_trade_logistics_di',
    comment: '物流轨迹明细日增量',
    layer: 'dwd',
    domain: 'trade',
    columns: [
      pk('轨迹ID'),
      ds(),
      fk('order_id', 'dwd_trade_order_enriched_di', '关联订单ID'),
      str('tracking_no', '物流单号'),
      str('carrier', '物流公司'),
      str('status', '物流状态: collected/transit/delivered/exception'),
      str('current_location', '当前位置'),
      ts('status_time', '状态更新时间'),
      dbl('estimated_delivery_hours', '预计剩余送达时长(小时)'),
      etl(),
    ],
  },

  /* ── User Domain ── */
  {
    name: 'dwd_user_session_di',
    comment: '用户会话明细日增量',
    layer: 'dwd',
    domain: 'user',
    columns: [
      pk('会话ID'),
      ds(),
      bigint('user_id', '用户ID'),
      str('session_id', '会话标识'),
      str('platform', '平台: app/web/h5'),
      str('device_type', '设备类型'),
      ts('session_start', '会话开始时间'),
      ts('session_end', '会话结束时间'),
      int('page_view_cnt', '页面浏览数'),
      int('event_cnt', '事件数'),
      str('landing_page', '落地页'),
      str('exit_page', '退出页'),
      etl(),
    ],
  },
  {
    name: 'dwd_user_behavior_event_di',
    comment: '用户行为事件明细日增量',
    layer: 'dwd',
    domain: 'user',
    columns: [
      pk('事件ID'),
      ds(),
      bigint('user_id', '用户ID'),
      str('event_type', '事件类型: click/expose/search/share/collect'),
      str('event_target', '事件目标(页面/商品/按钮)'),
      bigint('target_id', '目标对象ID'),
      ts('event_time', '事件时间'),
      str('page_name', '页面名称'),
      map('event_properties', '事件属性键值对'),
      str('platform', '平台'),
      etl(),
    ],
  },
  {
    name: 'dwd_user_registration_di',
    comment: '用户注册明细日增量',
    layer: 'dwd',
    domain: 'user',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('user_id', '用户ID'),
      str('register_channel', '注册渠道: organic/paid/referral/social'),
      str('register_source', '注册来源细分'),
      str('campaign_id', '营销活动ID'),
      str('device_type', '注册设备类型'),
      str('os_version', '操作系统版本'),
      ts('register_time', '注册时间'),
      bool('is_verified', '是否已实名验证'),
      etl(),
    ],
  },

  /* ── Product Domain ── */
  {
    name: 'dwd_product_exposure_click_di',
    comment: '商品曝光点击明细日增量',
    layer: 'dwd',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('product_id', '商品ID'),
      bigint('user_id', '用户ID'),
      str('scene', '曝光场景: search/recommend/list/detail'),
      int('position', '曝光位置'),
      bool('is_clicked', '是否点击'),
      ts('expose_time', '曝光时间'),
      ts('click_time', '点击时间'),
      str('algorithm_id', '推荐算法ID'),
      etl(),
    ],
  },
  {
    name: 'dwd_product_price_change_di',
    comment: '商品价格变更明细日增量',
    layer: 'dwd',
    domain: 'product',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('product_id', '商品ID'),
      decimal('price_before', '变更前价格'),
      decimal('price_after', '变更后价格'),
      dbl('change_pct', '变更幅度百分比'),
      str('change_reason', '变更原因: promotion/cost_adjust/competitive'),
      str('operator', '操作人'),
      ts('change_time', '变更时间'),
      etl(),
    ],
  },

  /* ── Risk Domain ── */
  {
    name: 'dwd_risk_event_detail_di',
    comment: '风险事件明细日增量',
    layer: 'dwd',
    domain: 'risk',
    columns: [
      pk('事件ID'),
      ds(),
      bigint('user_id', '关联用户ID'),
      str('event_type', '事件类型: login_anomaly/txn_anomaly/device_anomaly'),
      str('risk_level', '风险等级: low/medium/high/critical'),
      dbl('risk_score', '风险评分'),
      str('triggered_rules', '命中规则(逗号分隔)'),
      str('ip_address', 'IP地址'),
      str('device_fingerprint', '设备指纹'),
      ts('event_time', '事件时间'),
      str('disposition', '处置结果: allow/review/block'),
      etl(),
    ],
  },
  {
    name: 'dwd_risk_kyc_verification_di',
    comment: 'KYC身份验证明细日增量',
    layer: 'dwd',
    domain: 'risk',
    columns: [
      pk('记录ID'),
      ds(),
      bigint('user_id', '用户ID'),
      str('verification_type', '验证类型: id_card/face/bank_card/phone'),
      str('verification_result', '验证结果: pass/fail/pending'),
      dbl('confidence_score', '验证置信度'),
      str('fail_reason', '失败原因'),
      str('provider', '验证服务商'),
      ts('submit_time', '提交时间'),
      ts('complete_time', '完成时间'),
      etl(),
    ],
  },
];

/* ══════════════════════════════════════════════════
 * DIM Layer — 5 tables (维度表/配置表)
 * ══════════════════════════════════════════════════ */

const dimTables: TableDef[] = [
  {
    name: 'dim_ab_test_config',
    comment: 'A/B测试实验配置表',
    layer: 'dim',
    domain: 'product',
    columns: [
      pk('实验ID'),
      str('experiment_name', '实验名称'),
      str('experiment_type', '实验类型: feature/algorithm/ui'),
      str('hypothesis', '实验假设'),
      str('primary_metric', '核心指标'),
      dbl('min_detectable_effect', '最小可检测效应'),
      int('required_sample_size', '所需样本量'),
      date('start_date', '开始日期'),
      date('end_date', '结束日期'),
      str('status', '状态: draft/running/concluded'),
      str('owner', '负责人'),
      ts('created_at', '创建时间'),
    ],
  },
  {
    name: 'dim_model_version',
    comment: '模型版本管理表',
    layer: 'dim',
    domain: 'risk',
    columns: [
      pk('模型ID'),
      str('model_name', '模型名称'),
      str('model_type', '模型类型: classification/regression/ranking/clustering'),
      str('version', '版本号'),
      str('framework', '训练框架: spark_mllib/xgboost/lightgbm/pytorch'),
      str('feature_set_version', '特征集版本'),
      str('training_dataset', '训练数据集路径'),
      str('artifact_path', '模型产物存储路径'),
      dbl('offline_auc', '离线AUC'),
      str('deploy_status', '部署状态: staging/canary/production/retired'),
      ts('trained_at', '训练完成时间'),
      ts('deployed_at', '部署时间'),
    ],
  },
  {
    name: 'dim_feature_store_registry',
    comment: '特征仓库注册表',
    layer: 'dim',
    domain: 'user',
    columns: [
      pk('特征ID'),
      str('feature_name', '特征名称'),
      str('feature_group', '特征组: user_profile/trade_behavior/risk_signal'),
      str('data_type', '数据类型: numeric/categorical/embedding'),
      str('source_table', '来源表'),
      str('compute_logic', '计算逻辑(SparkSQL 片段)'),
      str('refresh_frequency', '更新频率: realtime/hourly/daily'),
      int('ttl_hours', '特征过期时间(小时)'),
      bool('is_online_serving', '是否在线服务'),
      ts('created_at', '创建时间'),
      ts('last_computed_at', '最近计算时间'),
    ],
  },
  {
    name: 'dim_risk_rule_config',
    comment: '风控规则配置表',
    layer: 'dim',
    domain: 'risk',
    columns: [
      pk('规则ID'),
      str('rule_name', '规则名称'),
      str('rule_category', '规则类别: velocity/amount/device/behavior'),
      str('rule_expression', '规则表达式(DSL)'),
      str('action_on_hit', '命中动作: pass/review/block'),
      int('priority', '优先级(越小越高)'),
      dbl('threshold', '阈值'),
      bool('is_enabled', '是否启用'),
      str('owner', '规则负责人'),
      ts('created_at', '创建时间'),
      ts('updated_at', '更新时间'),
    ],
  },
  {
    name: 'dim_spark_job_config',
    comment: 'Spark作业配置表',
    layer: 'dim',
    domain: 'trade',
    columns: [
      pk('作业ID'),
      str('job_name', '作业名称'),
      str('job_type', '作业类型: batch/streaming/ml_pipeline'),
      str('target_table', '目标表名'),
      str('schedule_cron', '调度CRON表达式'),
      str('spark_config', 'Spark配置JSON'),
      int('executor_num', 'Executor数量'),
      str('executor_memory', 'Executor内存(如4g)'),
      int('executor_cores', 'Executor核数'),
      str('dependencies', '上游依赖(逗号分隔)'),
      str('owner', '作业负责人'),
      bool('is_enabled', '是否启用'),
    ],
  },
];

/* ══════════════════════════════════════════════════
 * Metrics — 15 compute-focused metrics
 * ══════════════════════════════════════════════════ */

const sparkMetrics: MetricDef[] = [
  {
    name: 'realtime_gmv',
    displayName: '实时GMV',
    expression: 'SUM(gmv_realtime)',
    metricType: 'atomic',
    sourceTable: 'ads_trade_realtime_gmv',
    dimensions: ['ds'],
    granularity: ['minute', 'hour', 'day'],
    format: 'currency',
    description: '平台实时累计交易总额，分钟级更新',
  },
  {
    name: 'gmv_target_completion',
    displayName: 'GMV目标完成率',
    expression: 'gmv_realtime / gmv_target',
    metricType: 'derived',
    sourceTable: 'ads_trade_realtime_gmv',
    dimensions: ['ds'],
    format: 'percentage',
    description: '当日GMV相对目标的完成进度',
  },
  {
    name: 'pay_conversion_rate',
    displayName: '支付转化率',
    expression: 'pay_success_cnt / checkout_cnt',
    metricType: 'derived',
    sourceTable: 'dws_trade_payment_funnel_1d',
    dimensions: ['ds', 'platform'],
    format: 'percentage',
    description: '从提交订单到支付成功的转化率',
  },
  {
    name: 'coupon_roi',
    displayName: '优惠券ROI',
    expression: 'incremental_gmv / discount_amount',
    metricType: 'derived',
    sourceTable: 'dws_trade_coupon_effect_1d',
    dimensions: ['ds', 'coupon_id'],
    format: 'number',
    description: '优惠券带动增量GMV与优惠成本的投入产出比',
  },
  {
    name: 'churn_prediction_accuracy',
    displayName: '流失预测准确率',
    expression: 'SUM(CASE WHEN predicted = actual THEN 1 ELSE 0 END) / COUNT(*)',
    metricType: 'composite',
    sourceTable: 'ads_user_churn_prediction',
    dimensions: ['ds', 'model_version'],
    format: 'percentage',
    description: '流失预测模型在验证集上的准确率',
  },
  {
    name: 'user_retention_7d',
    displayName: '7日用户留存率',
    expression: 'retain_7d / cohort_size',
    metricType: 'derived',
    sourceTable: 'dws_user_retention_nd',
    dimensions: ['cohort_date', 'user_source'],
    format: 'percentage',
    description: '新用户注册后7日留存率',
  },
  {
    name: 'dau',
    displayName: '日活跃用户数',
    expression: 'SUM(dau)',
    metricType: 'atomic',
    sourceTable: 'dws_user_activity_1d',
    dimensions: ['ds', 'platform'],
    granularity: ['day'],
    format: 'number',
    description: '当日去重活跃用户数',
  },
  {
    name: 'ab_test_lift',
    displayName: 'A/B测试提升幅度',
    expression: 'lift_pct',
    metricType: 'atomic',
    sourceTable: 'ads_product_ab_test_result',
    dimensions: ['experiment_id', 'variant_name'],
    format: 'percentage',
    description: '实验组相对对照组的核心指标提升百分比',
  },
  {
    name: 'recommendation_ctr',
    displayName: '推荐点击率',
    expression: 'SUM(CASE WHEN is_clicked THEN 1 ELSE 0 END) / COUNT(*)',
    metricType: 'composite',
    sourceTable: 'dwd_product_exposure_click_di',
    filters: [{ column: 'scene', op: '=', value: 'recommend' }],
    dimensions: ['ds', 'algorithm_id'],
    format: 'percentage',
    description: '推荐场景下商品曝光到点击的转化率',
  },
  {
    name: 'inventory_stockout_rate',
    displayName: '缺货预警率',
    expression: 'SUM(CASE WHEN available_qty <= 0 THEN 1 ELSE 0 END) / COUNT(*)',
    metricType: 'composite',
    sourceTable: 'dws_product_inventory_snapshot_1d',
    dimensions: ['ds', 'warehouse_id'],
    format: 'percentage',
    description: '可用库存为零的商品占比',
  },
  {
    name: 'risk_model_auc',
    displayName: '风控模型AUC',
    expression: 'auc_roc',
    metricType: 'atomic',
    sourceTable: 'ads_risk_model_performance_tracker',
    dimensions: ['ds', 'model_name'],
    format: 'number',
    description: '风控模型的AUC-ROC评估指标',
  },
  {
    name: 'fraud_detection_rate',
    displayName: '欺诈检出率',
    expression: 'detection_accuracy',
    metricType: 'atomic',
    sourceTable: 'ads_risk_fraud_case_report',
    dimensions: ['ds', 'fraud_type'],
    format: 'percentage',
    description: '各类欺诈的检出准确率',
  },
  {
    name: 'risk_alert_resolve_rate',
    displayName: '风控告警处理率',
    expression: 'resolved_cnt / alert_cnt',
    metricType: 'derived',
    sourceTable: 'ads_risk_alert_summary',
    dimensions: ['ds', 'alert_level'],
    format: 'percentage',
    description: '风控告警的及时处理完成比例',
  },
  {
    name: 'feature_drift_alert_rate',
    displayName: '特征漂移告警率',
    expression: 'SUM(CASE WHEN feature_drift_score > 0.3 THEN 1 ELSE 0 END) / COUNT(*)',
    metricType: 'composite',
    sourceTable: 'ads_risk_model_performance_tracker',
    dimensions: ['ds'],
    format: 'percentage',
    description: '特征漂移分数超过阈值的模型占比',
  },
  {
    name: 'loss_prevention_amount',
    displayName: '挽回损失金额',
    expression: 'SUM(total_loss_prevented)',
    metricType: 'atomic',
    sourceTable: 'ads_risk_alert_summary',
    dimensions: ['ds', 'alert_category'],
    granularity: ['day', 'week', 'month'],
    format: 'currency',
    description: '风控体系拦截挽回的资金损失总额',
  },
];

/* ══════════════════════════════════════════════════
 * Glossary — 8 Spark/ML-specific terms
 * ══════════════════════════════════════════════════ */

const sparkGlossary: GlossaryDef[] = [
  {
    term: 'Feature Store（特征仓库）',
    sqlExpression: 'SELECT * FROM dim_feature_store_registry WHERE is_online_serving = true',
    description: '统一管理离线/在线特征的存储层，保证训练与推理使用相同特征口径，消除 training-serving skew',
  },
  {
    term: 'Model Serving（模型服务化）',
    sqlExpression: "SELECT * FROM dim_model_version WHERE deploy_status = 'production'",
    description: '将训练好的模型部署为实时/批量推理服务，通过 canary / blue-green 策略上线',
  },
  {
    term: 'Batch Scoring（批量评分）',
    sqlExpression: "SELECT * FROM dws_risk_model_output_1d WHERE ds = '${target_date}'",
    description: 'Spark 批处理模式下对全量数据进行模型推理打分，通常 T+1 产出',
  },
  {
    term: 'Feature Drift（特征漂移）',
    sqlExpression: 'SELECT model_name, feature_drift_score FROM ads_risk_model_performance_tracker WHERE feature_drift_score > 0.3',
    description: '线上特征分布相对训练集发生显著偏移，可能导致模型效果衰退，需要触发重训练',
  },
  {
    term: 'A/B Test Lift（实验提升效果）',
    sqlExpression: 'SELECT experiment_id, variant_name, lift_pct, p_value FROM ads_product_ab_test_result WHERE is_significant = true',
    description: '实验组相对对照组在核心指标上的提升幅度，需通过统计显著性检验（p < 0.05）确认',
  },
  {
    term: 'Churn Prediction（流失预测）',
    sqlExpression: "SELECT user_id, churn_probability, recommended_action FROM ads_user_churn_prediction WHERE churn_risk_level = 'high'",
    description: '基于用户行为特征预测未来N天内流失概率，驱动精准挽回策略',
  },
  {
    term: 'Spark Shuffle（Spark 数据重分布）',
    sqlExpression: "SELECT job_name, spark_config FROM dim_spark_job_config WHERE job_type = 'batch'",
    description: 'Spark 执行宽依赖算子（JOIN/GROUP BY/REPARTITION）时的数据网络传输过程，是性能优化的核心瓶颈',
  },
  {
    term: 'Supply-Demand Ratio（供需比）',
    sqlExpression: "SELECT product_id, supply_demand_ratio, risk_flag FROM ads_product_supply_demand_forecast WHERE risk_flag = 'shortage'",
    description: '当前供应量与预测需求量的比值，低于 1.0 表示供不应求，触发补货/调价策略',
  },
];

/* ══════════════════════════════════════════════════
 * Export
 * ══════════════════════════════════════════════════ */

export const sparkSeed: EngineSeedDefinition = {
  engineType: 'spark',
  name: 'Spark 计算引擎',
  description: 'Apache Spark 分布式计算引擎，承载 DWS 聚合计算和 ADS 应用层数据',
  dialect: 'sparksql',
  pgSchema: 'dw_spark',
  tables: [...dwsTables, ...adsTables, ...dwdTables, ...dimTables],
  metrics: sparkMetrics,
  glossary: sparkGlossary,
};
