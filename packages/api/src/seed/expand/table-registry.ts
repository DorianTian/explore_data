// packages/api/src/seed/expand/table-registry.ts
// Combinatorial table generator: domain × area × layer × suffix → TableDef[]

import type { TableDef } from '../engines/types.js';
import type { EngineExpandConfig } from './engine-config.js';
import { generateColumns } from './column-templates.js';

type Layer = 'ods' | 'dwd' | 'dws' | 'dim' | 'ads';
type Domain = 'trade' | 'user' | 'product' | 'risk';

const LAYERS: Layer[] = ['ods', 'dwd', 'dws', 'dim', 'ads'];
const DOMAINS: Domain[] = ['trade', 'user', 'product', 'risk'];

/* ──────────────────────────────────────────────
 * Business areas per domain
 * ────────────────────────────────────────────── */

const DOMAIN_AREAS: Record<Domain, string[]> = {
  trade: [
    'order', 'payment', 'refund', 'logistics', 'settlement',
    'invoice', 'contract', 'commission', 'subscription', 'coupon_usage',
    'flash_sale', 'group_buy', 'pre_sale', 'cross_border', 'after_sale',
    'dispute', 'evaluation', 'cart', 'checkout', 'delivery_fee',
  ],
  user: [
    'register', 'profile', 'login', 'session', 'behavior',
    'preference', 'feedback', 'notification', 'membership', 'address',
    'device', 'credit', 'identity', 'social', 'invite',
    'growth_task', 'signin', 'points', 'wallet', 'blacklist',
  ],
  product: [
    'catalog', 'sku', 'inventory', 'pricing', 'promotion',
    'review', 'recommendation', 'collection', 'tag', 'attribute',
    'warehouse', 'supplier', 'quality', 'lifecycle', 'bundle',
    'comparison', 'seo', 'media', 'variant', 'stock_alert',
  ],
  risk: [
    'fraud_detect', 'audit_log', 'compliance', 'monitor', 'alert',
    'rule_engine', 'blocklist', 'verification', 'credit_score', 'anti_spam',
    'device_fingerprint', 'ip_risk', 'transaction_risk', 'account_security',
    'data_quality',
  ],
};

/* ──────────────────────────────────────────────
 * Layer-specific table name suffixes
 * ────────────────────────────────────────────── */

const LAYER_SUFFIXES: Record<Layer, string[]> = {
  ods: ['_df', '_di'],
  dwd: ['_detail_di', '_detail_df'],
  dws: ['_1d', '_7d', '_30d'],
  dim: ['', '_hist'],
  ads: ['_1d', '_7d', '_30d'],
};

/* ──────────────────────────────────────────────
 * Chinese comment mappings
 * ────────────────────────────────────────────── */

const AREA_LABELS: Record<string, string> = {
  // trade
  order: '订单', payment: '支付', refund: '退款', logistics: '物流',
  settlement: '结算', invoice: '发票', contract: '合同', commission: '佣金',
  subscription: '订阅', coupon_usage: '优惠券使用', flash_sale: '秒杀',
  group_buy: '拼团', pre_sale: '预售', cross_border: '跨境',
  after_sale: '售后', dispute: '纠纷', evaluation: '评价', cart: '购物车',
  checkout: '结账', delivery_fee: '运费',
  // user
  register: '注册', profile: '档案', login: '登录', session: '会话',
  behavior: '行为', preference: '偏好', feedback: '反馈',
  notification: '通知', membership: '会员', address: '地址',
  device: '设备', credit: '信用', identity: '身份', social: '社交',
  invite: '邀请', growth_task: '成长任务', signin: '签到',
  points: '积分', wallet: '钱包', blacklist: '黑名单',
  // product
  catalog: '目录', sku: 'SKU', inventory: '库存', pricing: '定价',
  promotion: '促销', review: '评论', recommendation: '推荐',
  collection: '收藏', tag: '标签', attribute: '属性',
  warehouse: '仓库', supplier: '供应商', quality: '质量',
  lifecycle: '生命周期', bundle: '组合商品', comparison: '比价',
  seo: 'SEO', media: '素材', variant: '规格', stock_alert: '库存预警',
  // risk
  fraud_detect: '欺诈检测', audit_log: '审计日志', compliance: '合规',
  monitor: '监控', alert: '告警', rule_engine: '规则引擎',
  blocklist: '封禁名单', verification: '验证', credit_score: '信用评分',
  anti_spam: '反垃圾', device_fingerprint: '设备指纹', ip_risk: 'IP风险',
  transaction_risk: '交易风险', account_security: '账户安全',
  data_quality: '数据质量',
};

const LAYER_LABELS: Record<Layer, string> = {
  ods: '原始数据',
  dwd: '明细数据',
  dws: '汇总数据',
  dim: '维度',
  ads: '应用数据',
};

const SUFFIX_LABELS: Record<string, string> = {
  '_df': '日全量',
  '_di': '日增量',
  '_detail_di': '明细增量',
  '_detail_df': '明细全量',
  '_1d': '日汇总',
  '_7d': '周汇总',
  '_30d': '月汇总',
  '_hist': '历史快照',
  '': '',
};

/* ──────────────────────────────────────────────
 * Naming helpers
 * ────────────────────────────────────────────── */

function tableName(layer: Layer, domain: Domain, area: string, suffix: string): string {
  if (layer === 'dim') return `dim_${domain}_${area}${suffix}`;
  return `${layer}_${domain}_${area}${suffix}`;
}

function tableComment(layer: Layer, area: string, suffix: string): string {
  const areaLabel = AREA_LABELS[area] ?? area;
  const layerLabel = LAYER_LABELS[layer];
  const suffixLabel = SUFFIX_LABELS[suffix] ?? '';
  if (suffixLabel) {
    return `${areaLabel}${layerLabel}表-${suffixLabel}`;
  }
  return `${areaLabel}${layerLabel}表`;
}

/* ──────────────────────────────────────────────
 * Core: generate expand tables for one engine
 * ────────────────────────────────────────────── */

/**
 * Generate additional tables for an engine based on combinatorial expansion.
 *
 * Uses `config.layerWeights` to distribute `(targetTotal - existingCount)` new
 * tables across layers. Iterates domain × area × suffix per layer, skipping
 * any name already present in `existingNames`.
 */
export function generateExpandTables(
  config: EngineExpandConfig,
  existingCount: number,
  existingNames: Set<string>,
): TableDef[] {
  const needed = config.targetTotal - existingCount;
  if (needed <= 0) return [];

  // Resolve per-layer targets from weights
  const layerTargets = resolveLayerTargets(config.layerWeights, needed);
  const result: TableDef[] = [];

  for (const layer of LAYERS) {
    const target = layerTargets.get(layer) ?? 0;
    if (target <= 0) continue;

    let added = 0;
    const suffixes = LAYER_SUFFIXES[layer];

    // Iterate domains × areas × suffixes until this layer's quota is filled
    for (const domain of DOMAINS) {
      if (added >= target) break;
      const areas = DOMAIN_AREAS[domain];

      for (const area of areas) {
        if (added >= target) break;

        for (const suffix of suffixes) {
          if (added >= target) break;

          const name = tableName(layer, domain, area, suffix);
          if (existingNames.has(name)) continue;

          existingNames.add(name);
          result.push({
            name,
            comment: tableComment(layer, area, suffix),
            layer,
            domain,
            columns: generateColumns(layer, domain, area),
          });
          added++;
        }
      }
    }
  }

  return result;
}

/* ──────────────────────────────────────────────
 * Internal: distribute N tables across layers by weight
 * ────────────────────────────────────────────── */

function resolveLayerTargets(
  weights: Record<string, number>,
  total: number,
): Map<Layer, number> {
  const targets = new Map<Layer, number>();
  let assigned = 0;

  // First pass: proportional allocation (floor)
  const entries = LAYERS
    .filter((l) => weights[l] !== undefined && weights[l] > 0)
    .map((l) => ({ layer: l, weight: weights[l] }));

  for (const { layer, weight } of entries) {
    const count = Math.floor(total * weight);
    targets.set(layer, count);
    assigned += count;
  }

  // Second pass: distribute remainder by largest fractional part
  let remainder = total - assigned;
  if (remainder > 0) {
    const fractionals = entries
      .map(({ layer, weight }) => ({
        layer,
        frac: (total * weight) - Math.floor(total * weight),
      }))
      .sort((a, b) => b.frac - a.frac);

    for (const { layer } of fractionals) {
      if (remainder <= 0) break;
      targets.set(layer, (targets.get(layer) ?? 0) + 1);
      remainder--;
    }
  }

  return targets;
}
