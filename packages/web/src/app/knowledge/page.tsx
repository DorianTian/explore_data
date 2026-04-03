'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { apiPost } from '@/lib/api';

interface GlossaryEntry {
  id: string;
  term: string;
  sqlExpression: string;
  description: string | null;
}

export default function KnowledgePage() {
  const [term, setTerm] = useState('');
  const [sqlExpression, setSqlExpression] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [docContent, setDocContent] = useState('');
  const [docTitle, setDocTitle] = useState('');

  const handleAddGlossary = useCallback(async () => {
    if (!term.trim() || !sqlExpression.trim()) return;

    const res = await apiPost<GlossaryEntry>('/api/knowledge/glossary', {
      projectId: '00000000-0000-0000-0000-000000000000',
      term,
      sqlExpression,
      description: description || undefined,
    });

    if (res.success && res.data) {
      setEntries((prev) => [...prev, res.data!]);
      setTerm('');
      setSqlExpression('');
      setDescription('');
    }
  }, [term, sqlExpression, description]);

  const handleUploadDoc = useCallback(async () => {
    if (!docTitle.trim() || !docContent.trim()) return;

    await apiPost('/api/knowledge/docs', {
      projectId: '00000000-0000-0000-0000-000000000000',
      title: docTitle,
      content: docContent,
      docType: 'document',
    });

    setDocTitle('');
    setDocContent('');
  }, [docTitle, docContent]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Knowledge Base
          </h2>
          <p className="text-xs text-zinc-500">
            Business glossary and documents for better query understanding
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-8">
            {/* Glossary Section */}
            <section>
              <h3 className="text-sm font-medium text-zinc-900 mb-3 dark:text-zinc-100">
                Business Glossary
              </h3>
              <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    Term
                  </label>
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="e.g. 活跃用户"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    SQL Expression
                  </label>
                  <input
                    value={sqlExpression}
                    onChange={(e) => setSqlExpression(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm font-mono dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="WHERE last_login > NOW() - INTERVAL '30 days'"
                  />
                </div>
                <div className="flex gap-3">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="Description (optional)"
                  />
                  <button
                    onClick={handleAddGlossary}
                    disabled={!term.trim() || !sqlExpression.trim()}
                    className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {entries.length > 0 && (
                <div className="mt-3 space-y-2">
                  {entries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                    >
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 shrink-0">
                        {e.term}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {e.sqlExpression}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Document Upload Section */}
            <section>
              <h3 className="text-sm font-medium text-zinc-900 mb-3 dark:text-zinc-100">
                Upload Document
              </h3>
              <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  placeholder="Document title"
                />
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={6}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  placeholder="Paste your data dictionary, business rules, or documentation here..."
                />
                <button
                  onClick={handleUploadDoc}
                  disabled={!docTitle.trim() || !docContent.trim()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Upload
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
