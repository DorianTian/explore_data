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
          <Link href="/chat">
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
