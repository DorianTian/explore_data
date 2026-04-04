# Phase 4: Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an enterprise-grade landing page that showcases the NL2SQL platform capabilities and provides instant access to a live demo powered by seed data.

**Architecture:** Static landing page at `/landing` with animated sections. Hero section, live interactive demo (connecting to real API with seed data), feature showcase, and CTA. Use the design system from Phase 1.

**Tech Stack:** Next.js 16 App Router, Tailwind 4, existing design system primitives

**Prerequisite:** Phase 1 (design system), Phase 3 (seed data for live demo)

---

## Task 1: Landing Page Route & Layout

**Files:**
- Create: `packages/web/src/app/landing/page.tsx`
- Create: `packages/web/src/app/landing/layout.tsx`

- [ ] **Step 1: Create landing layout (no sidebar)**

```typescript
// packages/web/src/app/landing/layout.tsx
import type { ReactNode } from 'react';

export default function LandingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
```

- [ ] **Step 2: Create landing page shell**

```typescript
// packages/web/src/app/landing/page.tsx
'use client';

import { Hero } from '@/components/landing/hero';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { DemoSection } from '@/components/landing/demo-section';
import { CtaSection } from '@/components/landing/cta-section';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeatureShowcase />
      <DemoSection />
      <CtaSection />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/landing/
git commit -m "feat(web): add landing page route and layout"
```

---

## Task 2: Navigation Header

**Files:**
- Create: `packages/web/src/components/landing/nav-header.tsx`

- [ ] **Step 1: Create landing nav bar**

```typescript
// packages/web/src/components/landing/nav-header.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export function NavHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/landing" className="text-xl font-bold text-foreground tracking-tight">
            NL2SQL
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">
              功能
            </a>
            <a href="#demo" className="text-sm text-muted hover:text-foreground transition-colors">
              演示
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="primary" size="md">
              开始使用
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Add NavHeader to landing page**

In `packages/web/src/app/landing/page.tsx`, add `<NavHeader />` before `<Hero />`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/landing/nav-header.tsx packages/web/src/app/landing/page.tsx
git commit -m "feat(web): add landing page navigation header"
```

---

## Task 3: Hero Section

**Files:**
- Create: `packages/web/src/components/landing/hero.tsx`

- [ ] **Step 1: Implement hero with animated text and demo prompt**

```typescript
// packages/web/src/components/landing/hero.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

const ROTATING_QUERIES = [
  '上个月各区域的 GMV 是多少？',
  '销量 Top 10 的商品有哪些？',
  '新用户 7 日留存率趋势如何？',
  '各渠道的客单价对比',
  '库存周转率最低的品类？',
  '退款率和上月相比有什么变化？',
];

export function Hero() {
  const [queryIndex, setQueryIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const query = ROTATING_QUERIES[queryIndex];

    if (isTyping) {
      if (displayText.length < query.length) {
        const timer = setTimeout(() => {
          setDisplayText(query.slice(0, displayText.length + 1));
        }, 50);
        return () => clearTimeout(timer);
      }
      // Pause after typing complete
      const pauseTimer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(pauseTimer);
    }

    // Clear and move to next query
    const clearTimer = setTimeout(() => {
      setDisplayText('');
      setQueryIndex((i) => (i + 1) % ROTATING_QUERIES.length);
      setIsTyping(true);
    }, 500);
    return () => clearTimeout(clearTimer);
  }, [queryIndex, displayText, isTyping]);

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Enterprise-Grade Text-to-SQL
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight mb-6 tracking-tight">
          用自然语言
          <br />
          <span className="text-primary">查询你的数据</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
          连接你的数据库，用中文提问，AI 自动生成 SQL 并返回结果。
          支持多数据源、指标体系、知识库 RAG，企业级数据分析从未如此简单。
        </p>

        {/* Animated demo input */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-border bg-background shadow-lg">
            <Icon name="search" size={20} className="text-muted flex-shrink-0" />
            <span className="text-base text-foreground flex-1 text-left">
              {displayText}
              <span className="inline-block w-0.5 h-5 bg-primary animate-pulse-subtle ml-0.5" />
            </span>
            <Button size="sm" className="flex-shrink-0">
              <Icon name="send" size={14} />
            </Button>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4">
          <Link href="/">
            <Button size="lg">
              <Icon name="play" size={16} />
              免费体验
            </Button>
          </Link>
          <a href="#demo">
            <Button variant="secondary" size="lg">
              查看演示
            </Button>
          </a>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-12 mt-16 pt-8 border-t border-border/50">
          {[
            { value: '1000+', label: '张数据表' },
            { value: '7', label: '大业务域' },
            { value: '5', label: '种 SQL 方言' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/landing/hero.tsx
git commit -m "feat(web): add hero section with animated query typing"
```

---

## Task 4: Feature Showcase

**Files:**
- Create: `packages/web/src/components/landing/feature-showcase.tsx`

- [ ] **Step 1: Implement feature grid**

```typescript
// packages/web/src/components/landing/feature-showcase.tsx
'use client';

import { Icon, type IconName } from '@/components/shared/icon';

interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: 'message',
    title: '自然语言对话',
    description: '多轮对话式查询，AI 理解上下文，支持追问和修改。不需要写一行 SQL。',
  },
  {
    icon: 'database',
    title: '智能 Schema 理解',
    description: '自动解析 DDL，向量化匹配表结构，精准关联用户问题与数据模型。',
  },
  {
    icon: 'chart',
    title: '指标体系',
    description: '定义原子/派生/复合指标，AI 优先匹配指标口径，确保数据一致性。',
  },
  {
    icon: 'book',
    title: '业务知识库',
    description: '上传业务术语和文档，RAG 检索增强生成，让 AI 真正理解你的业务语言。',
  },
  {
    icon: 'shield',
    title: 'SQL 安全校验',
    description: 'ANTLR4 语法验证 + 危险模式检测 + 只读执行沙箱，从生成到执行全链路安全。',
  },
  {
    icon: 'star',
    title: '数据飞轮',
    description: '每次反馈自动优化：Golden SQL 训练、Few-shot 检索、持续提升准确率。',
  },
  {
    icon: 'layout',
    title: 'BI 看板市场',
    description: '一键保存查询为可视化 Widget，组装 Dashboard，团队共享分析成果。',
  },
  {
    icon: 'table',
    title: '多方言支持',
    description: 'PostgreSQL、MySQL、Hive、SparkSQL、FlinkSQL，一套平台覆盖全场景。',
  },
];

export function FeatureShowcase() {
  return (
    <section id="features" className="py-20 px-6 bg-surface/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            企业级 Text-to-SQL 平台
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            不止是 Chat-to-SQL，更是完整的数据分析工作台
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-[var(--radius-lg)] bg-background border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon name={f.icon} size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/landing/feature-showcase.tsx
git commit -m "feat(web): add feature showcase grid with 8 capabilities"
```

---

## Task 5: Interactive Demo Section

**Files:**
- Create: `packages/web/src/components/landing/demo-section.tsx`

- [ ] **Step 1: Build interactive demo that sends real queries**

```typescript
// packages/web/src/components/landing/demo-section.tsx
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

const DEMO_QUERIES = [
  { label: 'GMV 分析', query: '上个月各区域 GMV 是多少？' },
  { label: 'Top 商品', query: '销量最高的 10 个商品是什么？' },
  { label: '用户留存', query: '新用户 7 日留存率趋势' },
  { label: '退款分析', query: '各品类退款率排名' },
];

interface DemoResult {
  explanation: string;
  sql: string;
  confidence: number;
}

export function DemoSection() {
  const [selectedQuery, setSelectedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const runDemo = useCallback(async (query: string) => {
    setSelectedQuery(query);
    setLoading(true);
    setResult(null);

    try {
      // Use the first project/datasource from seed data
      const projectsRes = await fetch(`${API_BASE}/api/projects`);
      const projects = await projectsRes.json();
      if (!projects.success || !projects.data?.length) return;

      const projectId = projects.data[0].id;
      const dsRes = await fetch(`${API_BASE}/api/datasources?projectId=${projectId}`);
      const datasources = await dsRes.json();
      if (!datasources.success || !datasources.data?.length) return;

      const datasourceId = datasources.data[0].id;

      const queryRes = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, datasourceId, query }),
      });
      const queryData = await queryRes.json();

      if (queryData.success) {
        setResult({
          explanation: queryData.data.explanation,
          sql: queryData.data.sql,
          confidence: queryData.data.confidence,
        });
      }
    } catch {
      // Demo failure is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section id="demo" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            试一试
          </h2>
          <p className="text-muted text-lg">
            点击下方示例，看 AI 如何理解你的问题
          </p>
        </div>

        {/* Query chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {DEMO_QUERIES.map((dq) => (
            <button
              key={dq.label}
              onClick={() => runDemo(dq.query)}
              disabled={loading}
              className={`px-4 py-2 rounded-[var(--radius-full)] text-sm font-medium border transition-all cursor-pointer ${
                selectedQuery === dq.query
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary/50'
              } disabled:opacity-50`}
            >
              {dq.label}
            </button>
          ))}
        </div>

        {/* Result display */}
        <div className="rounded-[var(--radius-xl)] border border-border bg-background shadow-lg overflow-hidden">
          {/* Query bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface/50">
            <Icon name="message" size={18} className="text-primary" />
            <span className="text-sm text-foreground">
              {selectedQuery || '选择一个示例问题...'}
            </span>
          </div>

          {/* Output */}
          <div className="p-5 min-h-[200px]">
            {loading && (
              <div className="flex items-center gap-2 text-muted">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">AI 正在分析...</span>
              </div>
            )}

            {result && (
              <div className="space-y-4 animate-fade-in">
                {/* Explanation */}
                <p className="text-sm text-foreground leading-relaxed">
                  {result.explanation}
                </p>

                {/* SQL */}
                <div className="rounded-[var(--radius-md)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-900">
                    <span className="text-xs text-zinc-400">SQL</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      result.confidence >= 0.8
                        ? 'bg-emerald-900/50 text-emerald-400'
                        : 'bg-amber-900/50 text-amber-400'
                    }`}>
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <pre className="px-4 py-3 bg-zinc-900 text-[13px] font-mono text-emerald-400 overflow-x-auto">
                    {result.sql}
                  </pre>
                </div>
              </div>
            )}

            {!loading && !result && (
              <p className="text-sm text-muted text-center py-8">
                点击上方示例查看 AI 生成结果
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/landing/demo-section.tsx
git commit -m "feat(web): add interactive demo section with live API queries"
```

---

## Task 6: CTA Section & Final Assembly

**Files:**
- Create: `packages/web/src/components/landing/cta-section.tsx`
- Modify: `packages/web/src/app/landing/page.tsx`

- [ ] **Step 1: Create CTA section**

```typescript
// packages/web/src/components/landing/cta-section.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

export function CtaSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="p-12 rounded-[var(--radius-xl)] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            开始用自然语言分析数据
          </h2>
          <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
            内置 1000+ 张企业级示例数据表，7 大业务域，开箱即用。
          </p>
          <Link href="/">
            <Button size="lg">
              <Icon name="play" size={16} />
              立即体验
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-20 pt-8 border-t border-border/50 flex items-center justify-between">
        <p className="text-sm text-muted">NL2SQL — 智能数据查询平台</p>
        <p className="text-sm text-muted">
          Built with Next.js + Koa + PostgreSQL + Claude
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Assemble final landing page**

Update `packages/web/src/app/landing/page.tsx`:

```typescript
'use client';

import { NavHeader } from '@/components/landing/nav-header';
import { Hero } from '@/components/landing/hero';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { DemoSection } from '@/components/landing/demo-section';
import { CtaSection } from '@/components/landing/cta-section';

export default function LandingPage() {
  return (
    <>
      <NavHeader />
      <Hero />
      <FeatureShowcase />
      <DemoSection />
      <CtaSection />
    </>
  );
}
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/tianqiyin/Desktop/workspace/projects/nl2sql && pnpm --filter web build`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/landing/ packages/web/src/app/landing/
git commit -m "feat(web): complete landing page — hero, features, interactive demo, CTA"
```
