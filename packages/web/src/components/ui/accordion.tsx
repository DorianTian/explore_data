'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/shared/icon';

interface AccordionItemState {
  isOpen: boolean;
  toggle: () => void;
}

/** Root wrapper — manages nothing, just groups items */
interface AccordionRootProps {
  children: ReactNode;
  className?: string;
}

export function AccordionRoot({ children, className = '' }: AccordionRootProps) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

/** Single collapsible section */
interface AccordionItemProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  /** Badge or extra content rendered in the trigger row */
  extra?: ReactNode;
}

export function AccordionItem({
  title,
  icon,
  defaultOpen = false,
  children,
  className = '',
  extra,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  /* Measure content height for CSS variable */
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-border overflow-hidden transition-colors ${
        isOpen ? 'border-l-2 border-l-primary bg-surface/50' : 'bg-surface'
      } ${className}`}
    >
      <AccordionTrigger
        title={title}
        icon={icon}
        isOpen={isOpen}
        onToggle={toggle}
        extra={extra}
      />
      <AccordionContent isOpen={isOpen} height={height}>
        <div ref={contentRef}>{children}</div>
      </AccordionContent>
    </div>
  );
}

/** Clickable header */
interface AccordionTriggerProps {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  extra?: ReactNode;
}

function AccordionTrigger({
  title,
  icon,
  isOpen,
  onToggle,
  extra,
}: AccordionTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
      aria-expanded={isOpen}
    >
      <Icon
        name="chevronRight"
        size={14}
        className={`text-muted shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-90' : ''
        }`}
      />
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{title}</span>
      {extra && <span className="ml-auto shrink-0">{extra}</span>}
    </button>
  );
}

/** Animated expand/collapse */
interface AccordionContentProps {
  isOpen: boolean;
  height: number | undefined;
  children: ReactNode;
}

function AccordionContent({ isOpen, height, children }: AccordionContentProps) {
  const h = height ?? 0;

  return (
    <div
      className={`overflow-hidden ${
        isOpen ? 'animate-accordion-down' : 'animate-accordion-up'
      }`}
      style={
        {
          '--accordion-height': `${h}px`,
          height: isOpen ? `${h}px` : '0px',
          opacity: isOpen ? 1 : 0,
        } as React.CSSProperties
      }
      aria-hidden={!isOpen}
    >
      {children}
    </div>
  );
}
