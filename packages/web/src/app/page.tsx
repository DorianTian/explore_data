import Link from 'next/link';

/* ─── Static mock SQL for the hero preview ─── */
const MOCK_SQL_LINES = [
  { tokens: [{ type: 'keyword', text: 'SELECT' }, { type: 'plain', text: ' region,' }] },
  { tokens: [{ type: 'function', text: '  SUM' }, { type: 'plain', text: '(order_amount)' }, { type: 'keyword', text: ' AS' }, { type: 'plain', text: ' total_gmv,' }] },
  { tokens: [{ type: 'function', text: '  COUNT' }, { type: 'plain', text: '(*)' }, { type: 'keyword', text: ' AS' }, { type: 'plain', text: ' order_count' }] },
  { tokens: [{ type: 'keyword', text: 'FROM' }, { type: 'plain', text: ' orders' }] },
  { tokens: [{ type: 'keyword', text: 'WHERE' }, { type: 'plain', text: ' created_at >= ' }, { type: 'string', text: "'2024-03-01'" }] },
  { tokens: [{ type: 'keyword', text: 'GROUP BY' }, { type: 'plain', text: ' region' }] },
  { tokens: [{ type: 'keyword', text: 'ORDER BY' }, { type: 'plain', text: ' total_gmv' }, { type: 'keyword', text: ' DESC' }] },
  { tokens: [{ type: 'keyword', text: 'LIMIT' }, { type: 'number', text: ' 10' }, { type: 'plain', text: ';' }] },
];

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
      </svg>
    ),
    title: '智能语义理解',
    desc: 'Hybrid Agent 架构，深度理解自然语言意图，精准定位表、字段与指标关系',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: '多数据源支持',
    desc: 'PostgreSQL、MySQL、Hive、Flink SQL 等主流引擎一站接入，Schema 自动解析',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
    title: '可视化分析',
    desc: '自动推荐最佳图表类型，查询结果一键转化为直观的可视化看板',
  },
];

const STEPS = [
  { num: '01', title: '连接数据源', desc: '导入 Schema，AI 自动理解表结构与关系', icon: '🔗' },
  { num: '02', title: '提出问题', desc: '用自然语言描述查询意图，AI 生成精确 SQL', icon: '💬' },
  { num: '03', title: '查看结果', desc: '执行查询并自动生成图表，数据一目了然', icon: '📊' },
];

/* ─── Token color mapping for the SQL preview (light theme) ─── */
function tokenColor(type: string): string {
  switch (type) {
    case 'keyword': return 'text-primary font-medium';
    case 'function': return 'text-secondary';
    case 'string': return 'text-success';
    case 'number': return 'text-[#7c3aed]';
    default: return 'text-foreground/70';
  }
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans overflow-x-hidden">

      {/* ═══════════ NAV ═══════════ */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5s4.03-3 9-3 9 1.34 9 3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">NL2SQL</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">
            GitHub
          </a>
          <Link
            href="/chat"
            className="text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
          >
            进入应用
          </Link>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-32">
        {/* Subtle warm radial gradient on white */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-50"
          style={{ background: 'radial-gradient(ellipse at center, rgba(217,119,6,0.06) 0%, rgba(37,99,235,0.03) 40%, transparent 70%)' }}
        />

        <div className="animate-landing-entrance relative max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-foreground">
            用<span className="text-primary">自然语言</span>查询数据
          </h1>
          <p className="mt-6 text-lg text-muted max-w-xl mx-auto leading-relaxed">
            AI 驱动的 NL2SQL 引擎，将自然语言转化为精确的 SQL 查询
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-semibold text-base hover:bg-primary-hover transition-colors shadow-md"
            >
              开始使用
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-lg)] border border-border text-foreground font-medium text-base hover:bg-surface transition-colors"
            >
              查看源码
            </a>
          </div>
        </div>

        {/* ─── Hero SQL Preview ─── */}
        <div className="animate-landing-entrance-delayed relative mt-20 w-full max-w-2xl mx-auto">
          <div className="rounded-[var(--radius-xl)] border border-border bg-white shadow-lg overflow-hidden">
            {/* Terminal title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-error/60" />
                <span className="w-3 h-3 rounded-full bg-warning/60" />
                <span className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted ml-2 font-mono">nl2sql — query</span>
            </div>

            {/* Chat mockup */}
            <div className="p-5 space-y-4">
              {/* User question */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs text-secondary font-medium">U</span>
                </div>
                <div className="bg-surface rounded-[var(--radius-md)] px-4 py-2.5 text-sm text-foreground">
                  上个月各区域的 GMV 是多少？按 GMV 降序排列，取 Top 10
                </div>
              </div>

              {/* AI SQL response */}
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs text-primary font-medium">AI</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-surface rounded-[var(--radius-md)] border border-border p-4 font-mono text-[13px] leading-relaxed overflow-x-auto">
                    {MOCK_SQL_LINES.map((line, i) => (
                      <div key={i}>
                        {line.tokens.map((tok, j) => (
                          <span key={j} className={tokenColor(tok.type)}>{tok.text}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-2 pl-1">查询耗时 0.23s · 返回 8 行</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="relative z-10 px-6 py-28">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">核心能力</h2>
          <p className="text-center text-muted mb-16 max-w-lg mx-auto">
            从自然语言理解到 SQL 生成与可视化，端到端覆盖数据查询全链路
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-[var(--radius-xl)] border border-border bg-white p-7 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-primary/8 text-primary flex items-center justify-center mb-5 group-hover:bg-primary/12 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative z-10 px-6 py-28 bg-surface">
        <div className="relative max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">工作流程</h2>
          <p className="text-center text-muted mb-16 max-w-lg mx-auto">
            三步完成从提问到洞察的全过程
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative text-center">
                {/* Connector line (between items, not after last) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-border" />
                )}

                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border border-border bg-white shadow-sm mb-6 text-3xl">
                  {s.icon}
                </div>
                <div className="text-xs font-mono text-primary mb-2">{s.num}</div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="relative z-10 px-6 py-28">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            准备好用<span className="text-primary">自然语言</span>探索数据了吗？
          </h2>
          <p className="text-muted mb-10">
            无需编写 SQL，直接对话即可获得精确查询结果
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-[var(--radius-lg)] bg-primary text-white font-semibold text-base hover:bg-primary-hover transition-colors shadow-md"
          >
            开始使用
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="relative z-10 border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Built with <span className="text-primary">Claude AI</span> · NL2SQL v2.0
          </p>
          <div className="flex items-center gap-5">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">
              GitHub
            </a>
            <Link href="/chat" className="text-sm text-muted hover:text-foreground transition-colors">
              进入应用
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
