'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebarStore, SIDEBAR_MIN, SIDEBAR_MAX } from '@/stores/sidebar-store';
import { usePanelStore } from '@/stores/panel-store';
import { Icon, type IconName } from '@/components/shared/icon';
import { Tooltip } from '@/components/ui';
import { WorkspaceSelector } from './workspace-selector';
import { ConversationList } from './conversation-list';
import { useUserStore } from '@/stores/user-store';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { href: '/chat', label: '对话', icon: 'message' },
  { href: '/dashboard', label: 'BI 市场', icon: 'layout' },
  { href: '/schema', label: '数据源', icon: 'database' },
  { href: '/metrics', label: '指标', icon: 'chart' },
  { href: '/knowledge', label: '知识库', icon: 'book' },
];

export function Sidebar() {
  const pathname = usePathname();
  const width = useSidebarStore((s) => s.width);
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const setWidth = useSidebarStore((s) => s.setWidth);
  const toggleCollapse = useSidebarStore((s) => s.toggleCollapse);

  const togglePanel = usePanelStore((s) => s.togglePanel);
  const isPanelOpen = usePanelStore((s) => s.isOpen);
  const userName = useUserStore((s) => s.user?.name);
  const logout = useUserStore((s) => s.logout);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth + ev.clientX - startX));
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, setWidth],
  );

  return (
    <aside
      style={{ width }}
      className="relative flex flex-col h-full shrink-0 bg-sidebar-bg border-r border-sidebar-border transition-[width] duration-100 ease-out"
    >
      {/* Drag handle */}
      <div className="resize-handle" onMouseDown={startResize} />

      {/* Brand — click to landing */}
      <Link
        href="/"
        className={`block border-b border-sidebar-border hover:bg-surface-hover transition-colors ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
      >
        {isCollapsed ? (
          <div className="flex justify-center">
            <span className="text-sm font-bold text-primary">D</span>
          </div>
        ) : (
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">DataChat</h1>
            <p className="text-[11px] text-muted mt-0.5">智能数据对话平台</p>
          </div>
        )}
      </Link>

      {/* Workspace selector */}
      <div className={`border-b border-sidebar-border ${isCollapsed ? 'p-1.5' : 'p-2'}`}>
        <WorkspaceSelector collapsed={isCollapsed} />
      </div>

      {/* Quick chat trigger — Cmd+K */}
      <div className={`${isCollapsed ? 'px-1.5 py-1.5' : 'px-2 py-1.5'}`}>
        {isCollapsed ? (
          <Tooltip content="搜索查询 ⌘K" side="right">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex items-center justify-center w-full p-2 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            >
              <Icon name="search" size={16} />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-muted hover:text-foreground bg-surface border border-border/50 hover:border-border transition-colors cursor-pointer"
          >
            <Icon name="search" size={14} />
            <span className="flex-1 text-left">搜索查询...</span>
            <kbd className="text-[10px] text-muted-foreground bg-background px-1 py-0.5 rounded border border-border font-mono">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-1.5 space-y-0.5 shrink-0">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-[var(--radius-md)] text-sm transition-colors relative ${
                isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-1.5'
              } ${
                isActive
                  ? 'bg-surface-hover text-foreground font-medium'
                  : 'text-muted hover:bg-surface hover:text-foreground'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r" />
              )}
              <Icon
                name={item.icon}
                size={18}
                className={`shrink-0 ${isActive ? 'text-primary' : ''}`}
              />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                {linkContent}
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Conversation history (chat page only) */}
      {pathname === '/chat' && (
        <div className="flex-1 min-h-0 border-t border-sidebar-border">
          <ConversationList collapsed={isCollapsed} />
        </div>
      )}

      {/* Panel toggle (chat page only) */}
      {pathname === '/chat' && (
        <div className={`border-t border-sidebar-border ${isCollapsed ? 'p-1.5' : 'px-2 py-1.5'}`}>
          {isCollapsed ? (
            <Tooltip content={isPanelOpen ? '收起面板' : '展开面板'} side="right">
              <button
                onClick={togglePanel}
                className="flex items-center justify-center w-full p-2 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <Icon name={isPanelOpen ? 'panelRightClose' : 'panelRight'} size={16} />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={togglePanel}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-[var(--radius-md)] text-sm text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            >
              <Icon name={isPanelOpen ? 'panelRightClose' : 'panelRight'} size={16} />
              {isPanelOpen ? '收起面板' : '展开面板'}
            </button>
          )}
        </div>
      )}

      {/* User + collapse */}
      <div className={`border-t border-sidebar-border ${isCollapsed ? 'p-1.5' : 'px-2 py-1.5'}`}>
        {isCollapsed ? (
          <div className="space-y-1">
            <Tooltip content={userName ?? '未登录'} side="right">
              <button
                onClick={logout}
                className="flex items-center justify-center w-full p-2 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <Icon name="user" size={16} />
              </button>
            </Tooltip>
            <Tooltip content="展开侧栏" side="right">
              <button
                onClick={toggleCollapse}
                className="flex items-center justify-center w-full p-2 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={logout}
              className="flex items-center gap-2 px-1 py-1 text-xs text-muted hover:text-foreground transition-colors cursor-pointer rounded-[var(--radius-md)] hover:bg-surface"
              title="切换账号"
            >
              <Icon name="user" size={14} />
              <span className="truncate max-w-[120px]">{userName ?? '未登录'}</span>
            </button>
            <button
              onClick={toggleCollapse}
              className="flex items-center justify-center p-1.5 rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
