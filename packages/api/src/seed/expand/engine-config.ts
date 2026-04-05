// packages/api/src/seed/expand/engine-config.ts

export interface EngineExpandConfig {
  engineType: string;
  pgSchema: string;
  targetTotal: number;
  /** Layer distribution weights (must sum to 1.0) */
  layerWeights: Record<string, number>;
}

export const ENGINE_CONFIGS: EngineExpandConfig[] = [
  {
    engineType: 'mysql',
    pgSchema: 'dw_mysql',
    targetTotal: 400,
    layerWeights: { ods: 0.40, dim: 0.25, dwd: 0.20, dws: 0.15 },
  },
  {
    engineType: 'hive',
    pgSchema: 'dw_hive',
    targetTotal: 400,
    layerWeights: { dwd: 0.30, dws: 0.30, dim: 0.15, ads: 0.25 },
  },
  {
    engineType: 'doris',
    pgSchema: 'dw_doris',
    targetTotal: 400,
    layerWeights: { ads: 0.35, dws: 0.30, dwd: 0.20, dim: 0.15 },
  },
  {
    engineType: 'iceberg',
    pgSchema: 'dw_iceberg',
    targetTotal: 400,
    layerWeights: { dwd: 0.35, dws: 0.25, dim: 0.20, ads: 0.20 },
  },
  {
    engineType: 'spark',
    pgSchema: 'dw_spark',
    targetTotal: 400,
    layerWeights: { dws: 0.30, ads: 0.30, dwd: 0.25, dim: 0.15 },
  },
];
