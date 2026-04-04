'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/shared/icon';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Compact mode for sidebar selectors */
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  /** Enable type-to-filter when > 5 options */
  searchable?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = '请选择...',
  size = 'md',
  className = '',
  disabled = false,
  searchable,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 5;

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
    setHighlightIndex(-1);
  }, []);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Focus search on open
  useEffect(() => {
    if (open && showSearch) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, showSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-select-item]');
    items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (highlightIndex >= 0 && filtered[highlightIndex]) {
          onChange(filtered[highlightIndex].value);
          close();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        close();
        break;
    }
  };

  const heightClass = size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex items-center justify-between w-full rounded-[var(--radius-md)] border border-border bg-background px-2.5 ${heightClass} text-left transition-colors cursor-pointer hover:border-border-strong focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none disabled:opacity-50 disabled:cursor-not-allowed ${open ? 'border-primary/50 ring-2 ring-primary/20' : ''}`}
      >
        <span className={selected ? 'text-foreground truncate' : 'text-muted truncate'}>
          {selected ? (
            <span className="flex items-center gap-1.5">
              {selected.icon}
              {selected.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={`text-muted shrink-0 ml-1 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] rounded-[var(--radius-lg)] border border-border bg-surface-elevated shadow-lg animate-fade-in overflow-hidden">
          {/* Search */}
          {showSearch && (
            <div className="p-1.5 border-b border-border">
              <div className="flex items-center gap-1.5 px-2 h-7 rounded-[var(--radius-sm)] bg-background border border-border">
                <Icon name="search" size={12} className="text-muted shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="搜索..."
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
                />
              </div>
            </div>
          )}

          {/* Options */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted text-center">无匹配项</div>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value;
                const isHighlighted = i === highlightIndex;
                return (
                  <button
                    key={opt.value}
                    data-select-item
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      close();
                    }}
                    onMouseEnter={() => setHighlightIndex(i)}
                    className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs text-left transition-colors cursor-pointer ${
                      isHighlighted ? 'bg-surface-hover' : ''
                    } ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}
                  >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Icon name="check" size={12} className="text-primary ml-auto shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
