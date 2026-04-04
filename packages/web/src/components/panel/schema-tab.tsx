'use client';

import { useEffect, useCallback } from 'react';
import { useSchemaStore } from '@/stores/schema-store';
import { useProjectStore } from '@/stores/project-store';
import { SchemaTree } from './schema-tree';
import { Icon } from '@/components/shared/icon';
import { apiFetch } from '@/lib/api';

interface SchemaTableResponse {
  id: string;
  name: string;
  comment: string | null;
}

interface SchemaColumnResponse {
  id: string;
  name: string;
  dataType: string;
  comment: string | null;
  isPrimaryKey: boolean;
  isPii: boolean;
}

export function SchemaTab() {
  const { currentDatasourceId } = useProjectStore();
  const { tables, setTables, setRelationships } = useSchemaStore();

  const loadSchema = useCallback(async () => {
    if (!currentDatasourceId) return;

    const tablesResult = await apiFetch<SchemaTableResponse[]>(
      `/api/schema/tables?datasourceId=${currentDatasourceId}`,
    );

    if (!tablesResult.success || !tablesResult.data) return;

    const fullTables = await Promise.all(
      tablesResult.data.map(async (t) => {
        const detail = await apiFetch<{
          table: SchemaTableResponse;
          columns: SchemaColumnResponse[];
        }>(`/api/schema/tables/${t.id}`);

        return {
          id: t.id,
          name: t.name,
          comment: t.comment,
          columns: detail.data?.columns ?? [],
        };
      }),
    );

    setTables(fullTables);

    const relResult = await apiFetch<
      Array<{
        id: string;
        relationshipType: string;
        fromTableId: string;
        fromColumnId: string;
        toTableId: string;
        toColumnId: string;
      }>
    >(`/api/schema/relationships?datasourceId=${currentDatasourceId}`);

    if (relResult.success && relResult.data) {
      setRelationships(relResult.data);
    }
  }, [currentDatasourceId, setTables, setRelationships]);

  useEffect(() => {
    if (currentDatasourceId && !tables.length) {
      loadSchema();
    }
  }, [currentDatasourceId, tables.length, loadSchema]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-muted">Schema 浏览器</h4>
        <button
          onClick={loadSchema}
          className="text-muted hover:text-foreground cursor-pointer"
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <SchemaTree />
    </div>
  );
}
