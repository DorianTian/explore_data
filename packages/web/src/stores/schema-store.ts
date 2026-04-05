import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface SchemaColumn {
  id: string;
  name: string;
  dataType: string;
  comment: string | null;
  isPrimaryKey: boolean;
  isPII?: boolean;
}

export interface SchemaTable {
  id: string;
  name: string;
  comment: string | null;
  columns: SchemaColumn[];
  /** Warehouse layer inferred from table name prefix (DWD/DWS/DIM/ADS/ODS) */
  layer?: string;
  /** Business domain tag */
  domain?: string;
  /** Whether columns have been loaded (for lazy loading) */
  columnsLoaded?: boolean;
}

export interface SchemaRelationship {
  id: string;
  relationshipType: string;
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
  fromTableName?: string;
  fromColumnName?: string;
  toTableName?: string;
  toColumnName?: string;
}

/** Infer warehouse layer from table name prefix */
function inferLayer(tableName: string): string {
  const upper = tableName.toUpperCase();
  for (const layer of ['ODS', 'DWD', 'DWS', 'DIM', 'ADS']) {
    if (upper.startsWith(`${layer}_`) || upper.startsWith(`${layer}.`)) {
      return layer;
    }
  }
  return 'OTHER';
}

interface SchemaState {
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
  /** The datasourceId that current tables belong to */
  loadedDatasourceId: string | null;
  loading: boolean;
}

interface SchemaActions {
  fetchSchema: (datasourceId: string, force?: boolean) => Promise<void>;
  setTables: (tables: SchemaTable[]) => void;
  setRelationships: (relationships: SchemaRelationship[]) => void;
  updateColumnAnnotation: (
    tableId: string,
    columnId: string,
    updates: Partial<SchemaColumn>,
  ) => void;
  loadColumns: (tableId: string, columns: SchemaColumn[]) => void;
  clearSchema: () => void;
}

type SchemaStore = SchemaState & SchemaActions;

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  tables: [],
  relationships: [],
  loadedDatasourceId: null,
  loading: false,

  fetchSchema: async (datasourceId, force?: boolean) => {
    /* Skip if already loaded for this datasource (unless forced) */
    if (!force && get().loadedDatasourceId === datasourceId && get().tables.length > 0) {
      return;
    }

    set({ loading: true });

    const tablesResult = await apiFetch<
      Array<{
        id: string;
        name: string;
        comment: string | null;
        layer: string | null;
        domain: string | null;
      }>
    >(`/api/schema/tables?datasourceId=${datasourceId}`);

    if (tablesResult.success && tablesResult.data) {
      const tables: SchemaTable[] = tablesResult.data.map((t) => ({
        id: t.id,
        name: t.name,
        comment: t.comment,
        columns: [],
        layer: t.layer?.toUpperCase() ?? inferLayer(t.name),
        domain: t.domain ?? undefined,
        columnsLoaded: false,
      }));
      set({ tables, loadedDatasourceId: datasourceId });
    }

    const relResult = await apiFetch<
      Array<{
        id: string;
        relationshipType: string;
        fromTableId: string;
        fromColumnId: string;
        toTableId: string;
        toColumnId: string;
      }>
    >(`/api/schema/relationships?datasourceId=${datasourceId}`);

    if (relResult.success && relResult.data) {
      set({ relationships: relResult.data });
    }

    set({ loading: false });
  },

  setTables: (tables) => set({ tables }),
  setRelationships: (relationships) => set({ relationships }),

  updateColumnAnnotation: (tableId, columnId, updates) =>
    set((state) => ({
      tables: state.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              columns: table.columns.map((col) =>
                col.id === columnId ? { ...col, ...updates } : col,
              ),
            }
          : table,
      ),
    })),

  loadColumns: (tableId, columns) =>
    set((state) => ({
      tables: state.tables.map((table) =>
        table.id === tableId ? { ...table, columns, columnsLoaded: true } : table,
      ),
    })),

  clearSchema: () => set({ tables: [], relationships: [], loadedDatasourceId: null }),
}));
