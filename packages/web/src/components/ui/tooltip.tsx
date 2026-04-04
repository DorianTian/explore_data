'use client';

import { useState, useRef, type ReactNode } from 'react';

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const positionClass: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShow(true), 300);
      }}
      onMouseLeave={() => {
        clearTimeout(timeoutRef.current);
        setShow(false);
      }}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 px-2.5 py-1.5 text-xs rounded-[var(--radius-md)] bg-zinc-900 text-white shadow-md whitespace-nowrap animate-fade-in pointer-events-none ${positionClass[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
