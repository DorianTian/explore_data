'use client';

import { type SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, className = '', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`h-9 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  },
);
Select.displayName = 'Select';
