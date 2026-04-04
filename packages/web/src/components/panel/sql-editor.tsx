'use client';

import { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-background rounded-[var(--radius-md)] skeleton" />
    ),
  },
);

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSave?: () => void;
  readOnly?: boolean;
  height?: number;
  dialect?: string;
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  readOnly = false,
  height = 200,
  dialect = 'sql',
}: SqlEditorProps) {
  const editorRef = useRef<unknown>(null);

  const handleMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="rounded-[var(--radius-lg)] overflow-hidden border border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-background border-b border-border">
        <span className="text-xs text-muted font-mono">
          {dialect.toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          {onRun && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted hover:text-foreground h-6 px-2 text-xs"
              onClick={onRun}
            >
              <Icon name="play" size={12} />
              执行
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted hover:text-foreground h-6 px-2 text-xs"
              onClick={onSave}
            >
              <Icon name="save" size={12} />
              保存修正
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <MonacoEditor
        height={height}
        language="sql"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace",
          tabSize: 2,
          wordWrap: 'on',
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
