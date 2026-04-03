'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { ToastProvider, useToast } from '@/components/toast';
import { useProjectStore } from '@/stores/project-store';
import { apiPost } from '@/lib/api';

interface GlossaryEntry {
  id: string;
  term: string;
  sqlExpression: string;
  description: string | null;
}

function KnowledgePageInner() {
  const [term, setTerm] = useState('');
  const [sqlExpression, setSqlExpression] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [docContent, setDocContent] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const { currentProjectId } = useProjectStore();
  const { toast } = useToast();

  const handleAddGlossary = useCallback(async () => {
    if (!term.trim() || !sqlExpression.trim()) return;

    if (!currentProjectId) {
      toast('请先在左侧选择项目', 'error');
      return;
    }

    const res = await apiPost<GlossaryEntry>('/api/knowledge/glossary', {
      projectId: currentProjectId,
      term,
      sqlExpression,
      description: description || undefined,
    });

    if (res.success && res.data) {
      setEntries((prev) => [...prev, res.data!]);
      setTerm('');
      setSqlExpression('');
      setDescription('');
      toast('术语添加成功', 'success');
    } else {
      toast(res.error?.message ?? '添加术语失败', 'error');
    }
  }, [term, sqlExpression, description, currentProjectId, toast]);

  const handleUploadDoc = useCallback(async () => {
    if (!docTitle.trim() || !docContent.trim()) return;

    if (!currentProjectId) {
      toast('请先在左侧选择项目', 'error');
      return;
    }

    const res = await apiPost('/api/knowledge/docs', {
      projectId: currentProjectId,
      title: docTitle,
      content: docContent,
      docType: 'document',
    });

    if (res.success) {
      toast('文档上传成功', 'success');
      setDocTitle('');
      setDocContent('');
    } else {
      toast('文档上传失败', 'error');
    }
  }, [docTitle, docContent, currentProjectId, toast]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="border-b border-border px-6 py-3 shrink-0">
          <h2 className="text-sm font-medium text-foreground">知识库</h2>
          <p className="text-xs text-muted">
            添加业务术语和文档，帮助 AI 更好地理解你的查询意图
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-10">
            {/* Glossary Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <BookmarkIcon className="w-4 h-4 text-primary" />
                业务术语
              </h3>
              <div className="rounded-xl border border-border p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    术语
                  </label>
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="例如：活跃用户"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    SQL 表达式
                  </label>
                  <input
                    value={sqlExpression}
                    onChange={(e) => setSqlExpression(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="WHERE last_login > NOW() - INTERVAL '30 days'"
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="描述（可选）"
                  />
                  <button
                    onClick={handleAddGlossary}
                    disabled={!term.trim() || !sqlExpression.trim()}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    添加
                  </button>
                </div>
              </div>

              {entries.length > 0 && (
                <div className="space-y-2">
                  {entries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 hover:bg-surface/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground shrink-0">
                        {e.term}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted font-mono truncate">
                          {e.sqlExpression}
                        </p>
                        {e.description && (
                          <p className="text-xs text-muted mt-0.5">
                            {e.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Document Upload Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <DocIcon className="w-4 h-4 text-primary" />
                上传文档
              </h3>
              <div className="rounded-xl border border-border p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    文档标题
                  </label>
                  <input
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="数据字典 / 业务规则文档"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    文档内容
                  </label>
                  <textarea
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-y"
                    placeholder="粘贴数据字典、业务规则或其他文档内容..."
                  />
                </div>
                <button
                  onClick={handleUploadDoc}
                  disabled={!docTitle.trim() || !docContent.trim()}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  上传文档
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* -- Inline SVG icons -- */

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M11.986 3H12a2 2 0 012 2v6.5a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h.014A2.25 2.25 0 016.25 1h3.5a2.25 2.25 0 012.236 2zM9.75 2.5h-3.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5z" clipRule="evenodd" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 1.75C4 .784 4.784 0 5.75 0h4.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0113.25 15h-7.5A1.75 1.75 0 014 13.25V1.75zm1.75-.25a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H5.75z" />
      <path d="M6.25 7.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM6.25 10a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />
    </svg>
  );
}

export default function KnowledgePage() {
  return (
    <ToastProvider>
      <KnowledgePageInner />
    </ToastProvider>
  );
}
