'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, onClose, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="bg-background rounded-[var(--radius-lg)] shadow-lg border border-border w-full max-w-lg mx-4 animate-slide-up">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-6 pt-6 pb-2 ${className}`}>{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-foreground">{children}</h2>
  );
}

export function DialogBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

export function DialogFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 pb-6 pt-2 flex justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}
