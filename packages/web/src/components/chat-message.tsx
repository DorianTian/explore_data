'use client';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  chartConfig?: unknown;
  confidence?: number;
}

export function ChatMessage({ role, content, sql, confidence }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>

        {sql && (
          <div className="mt-3 rounded-md bg-zinc-900 p-3 text-xs font-mono text-green-400 overflow-x-auto">
            <pre>{sql}</pre>
          </div>
        )}

        {confidence !== undefined && confidence !== null && (
          <div className="mt-2 text-xs opacity-60">
            Confidence: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
