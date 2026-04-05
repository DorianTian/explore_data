# Data Guide Module — Design Spec

> Portal 首页新增「数据指南」模块，帮助新用户了解平台提供了哪些数据内容。

## 1. Module Position

插入首页 `page.tsx` 的「工作流程 (HOW IT WORKS)」section 与「CTA」section 之间。

## 2. Stats Banner Section

一行 4 个统计数字，水平排列，展示平台数据规模：

| Stat | Value | Sub-label |
|------|-------|-----------|
| 数据表 | 290+ | 覆盖全链路数仓分层 |
| 数据引擎 | 5 | Hive / MySQL / Doris / Iceberg / Spark |
| 业务域 | 4 | 交易 · 用户 · 商品 · 风控 |
| 业务指标 | 100+ | 预置核心分析指标 |

**Visual style:**
- 白底 section，`bg-background`
- 4-col grid (`md:grid-cols-4`)，居中 `max-w-5xl`
- 数字：`text-3xl font-bold text-primary`
- Label：`text-base font-semibold text-foreground`
- Sub-label：`text-sm text-muted`

## 3. Domain Quick Start Cards Section

紧接 Stats Banner 下方，4 列 domain 卡片：

### Card Structure

```
┌──────────────────────────────┐
│  {Icon}  {域名}               │
│  {表述}                       │
│  {N} 张表 · {M} 个指标         │
│                               │
│  ○ "示例查询 1"                │
│  ○ "示例查询 2"                │
│  ○ "示例查询 3"                │
│                               │
│         开始提问 →             │
└──────────────────────────────┘
```

### Domain Content

| 域 | Icon | 表述 | 示例查询 |
|---|---|---|---|
| 交易 | ShoppingCart | 订单、支付、退款、物流、结算 | 上个月各区域的 GMV 是多少？/ 本月订单取消率和上月相比有什么变化？/ 客单价最高的渠道是哪个？ |
| 用户 | Users | 登录、注册、行为、留存、画像 | 最近 7 天日活用户趋势如何？/ 复购率最高的用户群体是哪个城市？/ 用户 7 日留存率是多少？ |
| 商品 | Package | 浏览、库存、价格、品类、销量 | 销量 Top 10 的商品有哪些？/ 各品类 GMV 占比是多少？/ 库存周转率最低的品类？ |
| 风控 | Shield | 告警、KYC、黑名单、交易监控 | 本月风险拦截率趋势如何？/ 告警类型分布情况？/ 高风险交易占比多少？ |

### Interaction

- 每个示例查询是可点击的 chip / pill，点击跳转 `/chat?q={encodeURIComponent(query)}`
- 卡片底部 "开始提问 →" 按钮跳转 `/chat`
- Chat 页面已有 `?q=` param 支持，无需后端改动

### Responsive

- `lg:grid-cols-4` → `md:grid-cols-2` → `sm:grid-cols-1`
- 小屏 2 列堆叠，移动端单列

## 4. Visual Consistency

- 与现有 FEATURES section 风格统一：`rounded-xl border border-border bg-white shadow-sm`
- Hover 效果：`hover:shadow-md hover:border-primary/30`
- Section heading 复用已有风格：`text-3xl font-bold text-center`
- Icons 用 inline SVG，与 FEATURES section 同尺寸风格

## 5. Implementation Scope

- **改动文件**: 仅 `packages/web/src/app/page.tsx`
- **数据**: 纯静态常量，不依赖 API
- **表数 / 指标数**: 从 seed 定义取实际值，硬编码（demo 场景足够）
- **无新依赖**: 仅用 Next.js Link + inline SVG
- **无新路由**: 首页内嵌模块

## 6. Out of Scope

- 动态从 API 拉取实际表数/指标数（后续可升级）
- 按引擎/层级的详细 breakdown（现有 Schema 页面已覆盖）
- 搜索/过滤能力（不适合 portal 场景）
