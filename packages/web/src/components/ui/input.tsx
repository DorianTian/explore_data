'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-9 w-full rounded-[var(--radius-md)] border px-3 text-sm bg-background text-foreground placeholder:text-muted outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          error ? 'border-error' : 'border-border'
        } ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
