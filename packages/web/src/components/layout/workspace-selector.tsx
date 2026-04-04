'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { Icon } from '@/components/shared/icon';
import { Button, Select } from '@/components/ui';

interface WorkspaceSelectorProps {
  collapsed: boolean;
}

export function WorkspaceSelector({ collapsed }: WorkspaceSelectorProps) {
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

  const [open, setOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewDatasource, setShowNewDatasource] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newDsName, setNewDsName] = useState('');
  const [newDsDialect, setNewDsDialect] = useState('postgresql');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (currentProjectId && datasources.length === 0) {
      fetchDatasources(currentProjectId);
    }
  }, [currentProjectId, datasources.length, fetchDatasources]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentProject = projects.find((p) => p.id === currentProjectId);

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
    <div ref={popoverRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center w-full cursor-pointer transition-colors hover:bg-surface-hover rounded-[var(--radius-md)] ${
          collapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'
        }`}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)] bg-primary/10 text-primary shrink-0">
          <Icon name="database" size={16} />
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">
                {currentProject?.name ?? '选择项目'}
              </p>
            </div>
            <Icon
              name="chevronDown"
              size={14}
              className={`text-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          className={`absolute z-50 mt-1 rounded-[var(--radius-lg)] border border-border bg-background shadow-lg animate-scale-in overflow-hidden ${
            collapsed ? 'left-full top-0 ml-2' : 'left-0 right-0 top-full'
          }`}
          style={{ minWidth: 220 }}
        >
          {/* Project section */}
          <div className="p-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">
              项目
            </p>

            {loadingProjects ? (
              <div className="skeleton h-7 rounded-md mx-2 my-1" />
            ) : (
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentProject(p.id);
                    }}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-[var(--radius-md)] text-sm transition-colors cursor-pointer ${
                      p.id === currentProjectId
                        ? 'bg-surface-hover text-foreground font-medium'
                        : 'text-muted hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    <Icon name="layout" size={14} className={p.id === currentProjectId ? 'text-primary' : ''} />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* New project inline form */}
            {showNewProject ? (
              <div className="flex gap-1.5 px-2 pt-1.5">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') setShowNewProject(false);
                  }}
                  placeholder="项目名称"
                  autoFocus
                  className="flex-1 min-w-0 h-7 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                />
                <Button size="sm" onClick={handleCreateProject}>
                  创建
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2 pt-1.5 cursor-pointer"
              >
                <Icon name="plus" size={12} /> 新建项目
              </button>
            )}
          </div>

          {/* Datasource section */}
          {currentProjectId && (
            <div className="p-2 border-t border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1">
                数据源
              </p>

              <div className="space-y-0.5">
                {datasources.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setCurrentDatasource(d.id);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-[var(--radius-md)] text-sm transition-colors cursor-pointer ${
                      d.id === currentDatasourceId
                        ? 'bg-surface-hover text-foreground font-medium'
                        : 'text-muted hover:bg-surface hover:text-foreground'
                    }`}
                  >
                    <Icon name="database" size={14} className={d.id === currentDatasourceId ? 'text-primary' : ''} />
                    <span className="truncate">{d.name}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{d.dialect}</span>
                  </button>
                ))}
              </div>

              {/* New datasource inline form */}
              {showNewDatasource ? (
                <div className="space-y-1.5 px-2 pt-1.5">
                  <input
                    value={newDsName}
                    onChange={(e) => setNewDsName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateDatasource();
                      if (e.key === 'Escape') setShowNewDatasource(false);
                    }}
                    placeholder="数据源名称"
                    autoFocus
                    className="w-full h-7 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                  />
                  <div className="flex gap-1.5">
                    <Select
                      value={newDsDialect}
                      onChange={setNewDsDialect}
                      options={['postgresql', 'mysql', 'hive', 'sparksql', 'flinksql'].map((d) => ({
                        value: d,
                        label: d,
                      }))}
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
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2 pt-1.5 cursor-pointer"
                >
                  <Icon name="plus" size={12} /> 新建数据源
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
