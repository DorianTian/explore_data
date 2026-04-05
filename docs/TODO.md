# NL2SQL — 待办项

> 最后更新：2026-04-05

## 已完成 (V3 Enterprise Refactor)

- [x] **5 Engine-type datasources**: Hive/Iceberg/Spark/MySQL/Doris，each with pgSchema isolation
- [x] **290 DW layered tables**: ODS/DWD/DWS/DIM/ADS + physical tables + 100-row sample data per table
- [x] **90+ metrics**: aligned with ADS tables, metric hit → fast path query
- [x] **Dual-stage verification loop**: static AST + LLM 5-dimension scoring (pass >= 90, max 3 rounds)
- [x] **LLM chart recommendation**: 10 chart types + verification scoring
- [x] **Rich SSE streaming**: thinking content per pipeline step (schema linking, verification breakdown)
- [x] **Artifact panel**: 2-tab (Result + Schema), virtualized schema browser, fuzzy search
- [x] **Smart chart renderer**: MetricCard + 9 ECharts types + ChartErrorBoundary
- [x] **Data insight streaming**: `streamDataInsight` → `insight_token` SSE → ResultTab 数据分析区域
- [x] **SQL execution → analysis → chart 全链路**: pipeline 完整，5 engine datasource 均有物理表
- [x] **Trend analysis charts**: ChartRecommender temporal 分支 (line/multi-line)
- [x] **Conversation history persistence**: DB-backed, multi-turn follow-up in pipeline (up to 20 turns)
- [x] **Seed data cleanup**: V3 `cleanAll()` 每次 seed 先清空，无重复 datasource 问题
- [x] **Knowledge docs embedding**: upload 自动 embed, pgvector RAG retrieval in pipeline
- [x] **Production deploy fixes**: `.env.production` (build-time API URL) + retry with exponential backoff
- [x] **18 bugs fixed**: chart payload, hooks order, connection pool leak, CORS, N+1 fetch, hydration error, etc.

## P0 — End-to-end 体验打磨

- [ ] **Error UX 优化**: execution error 有中文提示，但 pipeline failure 仍暴露原始 PG 错误文本，需要 user-friendly 降级
- [ ] **前端 execution results 渲染验证**: 上轮 session 发现 95% confidence queries 结果不渲染，疑似 .next cache 或 SSE timing，需 browser console 调试确认
- [ ] **Deploy V3 to AWS EC2**: V3 refactor 代码尚未部署到线上

## P1 — Feature Gaps (低优先级)

- [ ] **Dashboard/BI market**: Gallery UI 可用，但缺 engineType 过滤
- [ ] **Golden query management**: session 内可标记，缺跨 session 管理页面
- [ ] **Schema annotation UI**: layer/domain 已展示，不可编辑
- [ ] **ER 图**: 查询涉及的表以 ER 图形式展示关联关系

## Infra 注意事项

- PM2 startup systemd hook 未注册 — EC2 reboot 仍需手动恢复
- Dev server: `WATCHPACK_POLLING=true pnpm dev:web` (Turbopack EMFILE workaround)
- Next.js 有 breaking changes — 写前端代码前读 `node_modules/next/dist/docs/`
