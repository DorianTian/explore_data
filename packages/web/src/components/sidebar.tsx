'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/project-store';

const navItems = [
  { href: '/', label: '对话', icon: MessageIcon },
  { href: '/schema', label: '数据源', icon: DatabaseIcon },
  { href: '/metrics', label: '指标', icon: ChartIcon },
  { href: '/knowledge', label: '知识库', icon: BookIcon },
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
    setCurrentProject,
    setCurrentDatasource,
    createProject,
    createDatasource,
  } = useProjectStore();

  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewDatasource, setShowNewDatasource] = useState(false);
  const [newDsName, setNewDsName] = useState('');
  const [newDsDialect, setNewDsDialect] = useState('postgresql');
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  return (
    <aside className="w-60 border-r border-border bg-sidebar-bg flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border">
        <h1 className="text-base font-semibold text-foreground tracking-tight">
          DataChat
        </h1>
        <p className="text-xs text-muted mt-0.5">智能数据对话平台</p>
      </div>

      {/* Project Selector */}
      <div className="px-3 py-3 border-b border-border space-y-2">
        <label className="block text-[11px] font-medium text-muted uppercase tracking-wider px-1">
          项目
        </label>
        {loadingProjects ? (
          <div className="skeleton h-8 rounded-md" />
        ) : (
          <div className="relative">
            <select
              value={currentProjectId ?? ''}
              onChange={(e) => setCurrentProject(e.target.value || null)}
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">选择项目...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>
        )}

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
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-2.5 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleCreateProject}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
            >
              创建
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-1.5 px-1 text-xs text-muted hover:text-foreground transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            新建项目
          </button>
        )}

        {/* Datasource Selector */}
        {currentProjectId && (
          <div className="pt-1 space-y-1.5">
            <label className="block text-[11px] font-medium text-muted uppercase tracking-wider px-1">
              数据源
            </label>
            <div className="relative">
              <select
                value={currentDatasourceId ?? ''}
                onChange={(e) => setCurrentDatasource(e.target.value || null)}
                className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">选择数据源...</option>
                {datasources.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.dialect})
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            </div>

            {showNewDatasource ? (
              <div className="space-y-1.5">
                <input
                  value={newDsName}
                  onChange={(e) => setNewDsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowNewDatasource(false);
                  }}
                  placeholder="数据源名称"
                  autoFocus
                  className="w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-1.5">
                  <select
                    value={newDsDialect}
                    onChange={(e) => setNewDsDialect(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="hive">Hive</option>
                    <option value="sparksql">SparkSQL</option>
                    <option value="flinksql">FlinkSQL</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (!newDsName.trim()) return;
                      const ds = await createDatasource(newDsName.trim(), newDsDialect);
                      if (ds) {
                        setCurrentDatasource(ds.id);
                        setShowNewDatasource(false);
                        setNewDsName('');
                      }
                    }}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover transition-colors"
                  >
                    创建
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewDatasource(true)}
                className="flex items-center gap-1.5 px-1 text-xs text-muted hover:text-foreground transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                新建数据源
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                ${
                  isActive
                    ? 'bg-surface-hover text-foreground font-medium'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-muted">DataChat v1.0</p>
      </div>
    </aside>
  );
}

/* -- Inline SVG icons to avoid external dependencies -- */

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.102 41.102 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.108 41.108 0 01-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z" clipRule="evenodd" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.92a2.25 2.25 0 00.659 1.59l2.474 2.475c.166.165.39.258.624.258h4.486c.234 0 .458-.093.624-.258l2.474-2.474A2.25 2.25 0 0016 3.095v-.92a.75.75 0 00-.63-.74A39.148 39.148 0 0010 1zM8.862 7.418l-2.474-2.474A3.75 3.75 0 015 3.095v-.308C6.596 2.468 8.268 2.25 10 2.25s3.404.218 5 .537v.308a3.75 3.75 0 01-1.388 1.849L11.138 7.42c-.415.415-.978.648-1.565.648H10.427c-.587 0-1.15-.234-1.565-.649z" clipRule="evenodd" />
      <path d="M6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM6.75 12.75a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM8.75 16.25a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06V3.44a.75.75 0 00-.546-.721A9.006 9.006 0 0015 2.5a8.96 8.96 0 00-4.25 1.065v13.254zM9.25 4.565A8.96 8.96 0 005 2.5a9.006 9.006 0 00-2.454.219A.75.75 0 002 3.44v11.62a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.565z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  );
}
