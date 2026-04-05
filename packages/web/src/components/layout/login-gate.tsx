'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '@/stores/user-store';

/** Simple login gate — enter a name to start, remembers via localStorage */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const user = useUserStore((s) => s.user);
  const loading = useUserStore((s) => s.loading);
  const login = useUserStore((s) => s.login);
  const restore = useUserStore((s) => s.restore);

  const [name, setName] = useState('分析师');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    restore();
  }, [restore]);

  const handleLogin = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    await login(name.trim());
    setSubmitting(false);
  }, [name, login]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-sm text-muted">加载中...</p>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">DataChat</h1>
          <p className="text-sm text-muted mt-1">智能数据对话平台</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              输入昵称开始使用
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              placeholder="输入你的昵称"
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={submitting || !name.trim()}
            className="w-full px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-primary text-primary-foreground hover:bg-primary-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '登录中...' : '进入'}
          </button>
        </div>
      </div>
    </div>
  );
}
