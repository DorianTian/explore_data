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
      const pauseTimer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(pauseTimer);
    }

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
      <div className="noise-overlay" />

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
          <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-border bg-surface shadow-lg">
            <Icon name="search" size={20} className="text-muted flex-shrink-0" />
            <span className="text-base text-foreground flex-1 text-left">
              {displayText}
              <span className="inline-block w-0.5 h-5 bg-primary animate-pulse-subtle ml-0.5 align-middle" />
            </span>
            <Button size="sm" className="flex-shrink-0">
              <Icon name="send" size={14} />
            </Button>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4">
          <Link href="/chat">
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
            { value: '54', label: '个预置指标' },
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
