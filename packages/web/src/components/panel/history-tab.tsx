'use client';

import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { apiFetch } from '@/lib/api';
import { Badge, Input } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

interface QueryRecord {
  id: string;
  naturalLanguage: string;
  generatedSql: string;
  correctedSql: string | null;
  status: string;
  isGolden: boolean;
  tablesUsed: string[] | null;
  createdAt: string;
}

interface HistoryTabProps {
  onSelectQuery?: (query: string) => void;
}

const STATUS_BADGE: Record<
  string,
  { variant: 'success' | 'warning' | 'error' | 'default'; label: string }
> = {
  accepted: { variant: 'success', label: '已接受' },
  pending: { variant: 'warning', label: '待验证' },
  rejected: { variant: 'error', label: '已拒绝' },
};

export function HistoryTab({ onSelectQuery }: HistoryTabProps) {
  const { currentProjectId } = useProjectStore();
  const [records, setRecords] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadHistory = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    const result = await apiFetch<QueryRecord[]>(
      `/api/query/history?projectId=${currentProjectId}`,
    );
    if (result.success && result.data) {
      setRecords(result.data);
    }
    setLoading(false);
  }, [currentProjectId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = records.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (
      search &&
      !r.naturalLanguage.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  if (!currentProjectId) {
    return (
      <div className="text-sm text-muted text-center py-8">
        选择项目查看查询历史
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter */}
      <div className="space-y-2">
        <Input
          placeholder="搜索查询..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['all', 'accepted', 'pending', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2 py-1 text-xs rounded-[var(--radius-full)] transition-colors cursor-pointer ${
                filterStatus === status
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted hover:text-foreground'
              }`}
            >
              {status === 'all'
                ? '全部'
                : (STATUS_BADGE[status]?.label ?? status)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-sm text-muted text-center py-4">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted text-center py-4">暂无记录</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="p-3 rounded-[var(--radius-md)] border border-border hover:bg-surface transition-colors cursor-pointer"
              onClick={() => onSelectQuery?.(record.naturalLanguage)}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm text-foreground line-clamp-2 flex-1">
                  {record.naturalLanguage}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {record.isGolden && (
                    <Icon
                      name="star"
                      size={12}
                      filled
                      className="text-golden"
                    />
                  )}
                  <Badge
                    variant={STATUS_BADGE[record.status]?.variant ?? 'default'}
                  >
                    {STATUS_BADGE[record.status]?.label ?? record.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>
                  {new Date(record.createdAt).toLocaleDateString()}
                </span>
                {record.tablesUsed && record.tablesUsed.length > 0 && (
                  <span>· {record.tablesUsed.join(', ')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={loadHistory}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground mx-auto cursor-pointer"
      >
        <Icon name="refresh" size={12} />
        刷新
      </button>
    </div>
  );
}
