'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export function NavHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/landing" className="text-xl font-bold text-foreground tracking-tight">
            DataChat
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
          <Link href="/chat">
            <Button variant="primary" size="md">
              开始使用
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
