'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              animate-slide-up rounded-lg px-4 py-3 text-sm shadow-lg backdrop-blur-sm
              transition-all duration-300
              ${t.type === 'success' ? 'bg-emerald-600/90 text-white' : ''}
              ${t.type === 'error' ? 'bg-red-600/90 text-white' : ''}
              ${t.type === 'info' ? 'bg-zinc-800/90 text-zinc-100 dark:bg-zinc-200/90 dark:text-zinc-900' : ''}
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
