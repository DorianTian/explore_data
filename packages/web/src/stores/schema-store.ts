import { create } from 'zustand';

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

interface SchemaState {
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
}

interface SchemaActions {
  setTables: (tables: SchemaTable[]) => void;
  setRelationships: (relationships: SchemaRelationship[]) => void;
  updateColumnAnnotation: (
    tableId: string,
    columnId: string,
    updates: Partial<SchemaColumn>,
  ) => void;
  /** Load columns for a specific table (lazy loading) */
  loadColumns: (tableId: string, columns: SchemaColumn[]) => void;
  clearSchema: () => void;
}

type SchemaStore = SchemaState & SchemaActions;

export const useSchemaStore = create<SchemaStore>((set) => ({
  tables: [],
  relationships: [],

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
        table.id === tableId
          ? { ...table, columns, columnsLoaded: true }
          : table,
      ),
    })),

  clearSchema: () => set({ tables: [], relationships: [] }),
}));
