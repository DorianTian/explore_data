import { describe, it, expect } from 'vitest';
import { ChartRecommender } from '../chart-recommender.js';

describe('ChartRecommender', () => {
  const recommender = new ChartRecommender();

  it('recommends KPI for single row, single numeric', () => {
    const result = recommender.recommend(
      [{ total: 12345 }],
      [{ name: 'total', dataType: 'numeric' }],
    );
    expect(result.chartType).toBe('kpi');
  });

  it('recommends line for temporal + numeric', () => {
    const result = recommender.recommend(
      [
        { date: '2026-01', revenue: 100 },
        { date: '2026-02', revenue: 150 },
        { date: '2026-03', revenue: 200 },
      ],
      [
        { name: 'date', dataType: 'date' },
        { name: 'revenue', dataType: 'numeric' },
      ],
    );
    expect(result.chartType).toBe('line');
  });

  it('recommends multi-line for temporal + multiple numerics', () => {
    const result = recommender.recommend(
      [
        { month: '2026-01', revenue: 100, cost: 80 },
        { month: '2026-02', revenue: 150, cost: 90 },
      ],
      [
        { name: 'month', dataType: 'timestamp' },
        { name: 'revenue', dataType: 'numeric' },
        { name: 'cost', dataType: 'numeric' },
      ],
    );
    expect(result.chartType).toBe('multi_line');
    expect(result.config.series).toHaveLength(2);
  });

  it('recommends bar for categorical + numeric (few categories)', () => {
    const result = recommender.recommend(
      [
        { region: 'East', sales: 100 },
        { region: 'West', sales: 200 },
        { region: 'North', sales: 150 },
      ],
      [
        { name: 'region', dataType: 'varchar' },
        { name: 'sales', dataType: 'numeric' },
      ],
    );
    expect(['bar', 'pie']).toContain(result.chartType);
  });

  it('recommends horizontal bar for many categories', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      product: `Product ${i}`,
      sales: (i + 1) * 10,
    }));
    const result = recommender.recommend(rows, [
      { name: 'product', dataType: 'varchar' },
      { name: 'sales', dataType: 'integer' },
    ]);
    expect(result.chartType).toBe('horizontal_bar');
  });

  it('recommends scatter for 2 numerics', () => {
    const result = recommender.recommend(
      [
        { height: 170, weight: 65 },
        { height: 180, weight: 80 },
      ],
      [
        { name: 'height', dataType: 'integer' },
        { name: 'weight', dataType: 'integer' },
      ],
    );
    expect(result.chartType).toBe('scatter');
  });

  it('recommends table for empty results', () => {
    const result = recommender.recommend([], [
      { name: 'id', dataType: 'integer' },
    ]);
    expect(result.chartType).toBe('table');
  });

  it('recommends grouped bar for categorical + multiple numerics', () => {
    const result = recommender.recommend(
      [
        { dept: 'Engineering', q1: 100, q2: 120 },
        { dept: 'Sales', q1: 80, q2: 90 },
      ],
      [
        { name: 'dept', dataType: 'varchar' },
        { name: 'q1', dataType: 'numeric' },
        { name: 'q2', dataType: 'numeric' },
      ],
    );
    expect(result.chartType).toBe('grouped_bar');
  });
});
