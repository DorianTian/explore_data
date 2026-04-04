# NL2SQL — 待办项

> 最后更新：2026-04-04

## P0 — 数据分析与趋势展示

- [ ] **数据分析（insight）流式展示**：SQL 执行成功后，`streamDataInsight` 生成的分析内容应实时流式展示在 artifact panel 的"数据分析"区域。当前因 SQL 执行常失败，insight 从未在 UI 中展示过
- [ ] **趋势分析图表**：时间序列查询（如"本月 vs 上月取消率"）需要趋势折线图。ChartRecommender 需增加时间序列趋势类推荐逻辑
- [ ] **执行 → 分析 → 可视化全链路打通**：目前 SQL 生成可用，但下游执行/分析/图表因物理表缺失未跑通

## P1 — Seed 数据对齐

- [ ] **Metadata 与物理表不匹配**：7 个大域 seed（电商交易分析、金融风控分析等，共 2000+ 表 metadata）没有对应物理表，SQL 执行必定报 `relation does not exist`。仅"电商主库""金融风控库""运维日志库"3 个小数据源有物理表（含样本数据）
- [ ] **重复数据源清理**：seed 跑了两次，7 个大域各有 2 条 datasource 记录（有 FK 依赖无法直接删除）
- [ ] **方案选择**：(A) 为 seed metadata 创建 stub 物理表（DDL only, no data）；(B) QueryExecutor 执行失败时优雅降级；(C) 只保留有物理表的数据源做 demo

## P2 — 前端交互优化

- [ ] **Chat vs Artifact 内容分工**（已部分实现）：chat 只展示简短说明 + SQL 卡片，artifact panel 展示 SQL 编辑器 + 数据分析 + 涉及表结构
- [ ] **Pipeline 流式步骤**（已实现）：SSE 实时推送 + 累积 log 展示（Koa `ctx.res.flushHeaders()` 修复了缓冲问题）
- [ ] **ER 图集成到 artifact panel**：查询涉及的表以 ER 图形式展示关联关系

## 已完成（本轮 session）

- [x] dotenv 加载（server.ts + seed/index.ts）
- [x] SSE Koa response buffering 修复（`ctx.res` + `flushHeaders` 替代 `ctx.body = PassThrough`）
- [x] Pipeline `onProgress` callback 穿透（pipeline → orchestrator → runFullPipeline）
- [x] StreamingIndicator 累积 log 模式（步骤一条条叠加，非替换）
- [x] QueryExecutor `$1` 语法错误修复 + `user`/`username` 字段兼容
- [x] Seed 2000+ 表 metadata + 业务物理表（orders/products/users/transactions 等）
- [x] 所有 datasource connection_config 补齐
- [x] Artifact panel 新增"表结构" tab + `filterTables` 过滤
- [x] Chat 不再重复 artifact panel 的完整内容
