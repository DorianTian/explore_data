'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { usePanelStore } from '@/stores/panel-store';
import { Icon, type IconName } from '@/components/shared/icon';
import { Button, Select } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { href: '/', label: '首页', icon: 'home' },
  { href: '/chat', label: '对话', icon: 'message' },
  { href: '/schema', label: '数据源', icon: 'database' },
  { href: '/metrics', label: '指标', icon: 'chart' },
  { href: '/knowledge', label: '知识库', icon: 'book' },
  { href: '/dashboard', label: '看板', icon: 'layout' },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    projects,
    datasources,
    currentProjectId,
    currentDatasourceId,
    loadingProjects,
    fetchProjects,
    fetchDatasources,
    setCurrentProject,
    setCurrentDatasource,
    createProject,
    createDatasource,
  } = useProjectStore();

  const togglePanel = usePanelStore((s) => s.togglePanel);
  const isPanelOpen = usePanelStore((s) => s.isOpen);

  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewDatasource, setShowNewDatasource] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newDsName, setNewDsName] = useState('');
  const [newDsDialect, setNewDsDialect] = useState('postgresql');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // After page refresh, persist restores currentProjectId but datasources is empty — re-fetch
  useEffect(() => {
    if (currentProjectId && datasources.length === 0) {
      fetchDatasources(currentProjectId);
    }
  }, [currentProjectId, datasources.length, fetchDatasources]);

  const handleCreateProject = useCallback(async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    const project = await createProject(trimmed);
    if (project) {
      setCurrentProject(project.id);
      setShowNewProject(false);
      setNewProjectName('');
    }
  }, [newProjectName, createProject, setCurrentProject]);

  const handleCreateDatasource = useCallback(async () => {
    const trimmed = newDsName.trim();
    if (!trimmed) return;
    const ds = await createDatasource(trimmed, newDsDialect);
    if (ds) {
      setCurrentDatasource(ds.id);
      setShowNewDatasource(false);
      setNewDsName('');
    }
  }, [newDsName, newDsDialect, createDatasource, setCurrentDatasource]);

  return (
    <aside className="w-[var(--sidebar-width)] flex flex-col border-r border-border bg-sidebar-bg h-full shrink-0">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          NL2SQL
        </h1>
        <p className="text-xs text-muted mt-0.5">智能数据查询平台</p>
      </div>

      {/* Project / Datasource selectors */}
      <div className="px-3 py-3 border-b border-border space-y-2">
        <div>
          <label className="block text-[11px] font-medium text-muted uppercase tracking-wider px-1 mb-1">
            项目
          </label>
          {loadingProjects ? (
            <div className="skeleton h-8 rounded-md" />
          ) : (
            <Select
              value={currentProjectId ?? ''}
              onChange={(v) => setCurrentProject(v || null)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="选择项目..."
              size="sm"
            />
          )}
        </div>

        {showNewProject ? (
          <div className="flex gap-1.5">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setShowNewProject(false);
              }}
              placeholder="项目名称"
              autoFocus
              className="flex-1 min-w-0 h-7 rounded border border-border bg-background px-2 text-xs outline-none"
            />
            <Button size="sm" onClick={handleCreateProject}>
              创建
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-1 cursor-pointer"
          >
            <Icon name="plus" size={12} /> 新建项目
          </button>
        )}

        {currentProjectId && (
          <div className="pt-1 space-y-1.5">
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider px-1">
              数据源
            </label>
            <Select
              value={currentDatasourceId ?? ''}
              onChange={(v) => setCurrentDatasource(v || null)}
              options={datasources.map((d) => ({ value: d.id, label: `${d.name} (${d.dialect})` }))}
              placeholder="选择数据源..."
              size="sm"
            />

            {showNewDatasource ? (
              <div className="space-y-1.5">
                <input
                  value={newDsName}
                  onChange={(e) => setNewDsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateDatasource();
                    if (e.key === 'Escape') setShowNewDatasource(false);
                  }}
                  placeholder="数据源名称"
                  autoFocus
                  className="w-full h-7 rounded border border-border bg-background px-2 text-xs outline-none"
                />
                <div className="flex gap-1.5">
                  <Select
                    value={newDsDialect}
                    onChange={setNewDsDialect}
                    options={['postgresql', 'mysql', 'hive', 'sparksql', 'flinksql'].map((d) => ({ value: d, label: d }))}
                    size="sm"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleCreateDatasource}>
                    创建
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewDatasource(true)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-1 cursor-pointer"
              >
                <Icon name="plus" size={12} /> 新建数据源
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors ${
                isActive
                  ? 'bg-surface-hover text-foreground font-medium'
                  : 'text-muted hover:bg-surface hover:text-foreground'
              }`}
            >
              <Icon
                name={item.icon}
                size={18}
                className={isActive ? 'text-primary' : ''}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Panel toggle (chat page only) */}
      {pathname === '/chat' && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={togglePanel}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-md)] text-sm text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <Icon
              name={isPanelOpen ? 'panelRightClose' : 'panelRight'}
              size={16}
            />
            {isPanelOpen ? '收起面板' : '展开面板'}
          </button>
        </div>
      )}

      {/* Version */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-muted">NL2SQL v2.0</p>
      </div>
    </aside>
  );
}
