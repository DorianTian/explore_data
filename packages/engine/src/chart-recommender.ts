export type ChartType =
  | 'kpi'
  | 'bar'
  | 'horizontal_bar'
  | 'line'
  | 'multi_line'
  | 'scatter'
  | 'grouped_bar'
  | 'pie'
  | 'table';

export interface ChartRecommendation {
  chartType: ChartType;
  config: EChartsConfig;
  alternativeTypes: ChartType[];
}

export interface EChartsConfig {
  title?: { text: string };
  xAxis?: { type: string; data?: unknown[] };
  yAxis?: { type: string; data?: unknown[] };
  series: Array<{
    name?: string;
    type: string;
    data: unknown[];
  }>;
}

interface ColumnAnalysis {
  name: string;
  type: 'numeric' | 'categorical' | 'temporal' | 'unknown';
  distinctCount: number;
}

/**
 * Chart Recommender — auto-selects the best chart type based on query result shape.
 * Generates ECharts-compatible config.
 */
export class ChartRecommender {
  recommend(
    rows: Record<string, unknown>[],
    columns: Array<{ name: string; dataType: string }>,
  ): ChartRecommendation {
    if (rows.length === 0) {
      return this.buildTable(rows, columns);
    }

    const analysis = columns.map((col) => this.analyzeColumn(col, rows));
    const numericCols = analysis.filter((c) => c.type === 'numeric');
    const categoricalCols = analysis.filter((c) => c.type === 'categorical');
    const temporalCols = analysis.filter((c) => c.type === 'temporal');

    // Single row, single numeric → KPI card
    if (rows.length === 1 && numericCols.length === 1 && categoricalCols.length === 0) {
      return this.buildKpi(rows[0], numericCols[0]);
    }

    // 1 temporal + 1 numeric → Line chart
    if (temporalCols.length === 1 && numericCols.length === 1) {
      return this.buildLine(rows, temporalCols[0], numericCols[0]);
    }

    // 1 temporal + N numeric → Multi-line chart
    if (temporalCols.length === 1 && numericCols.length > 1) {
      return this.buildMultiLine(rows, temporalCols[0], numericCols);
    }

    // 1 categorical + 1 numeric → Bar chart
    if (categoricalCols.length === 1 && numericCols.length === 1) {
      const cat = categoricalCols[0];
      if (cat.distinctCount > 7) {
        return this.buildHorizontalBar(rows, cat, numericCols[0]);
      }
      if (cat.distinctCount <= 5 && rows.length <= 8) {
        return this.buildPie(rows, cat, numericCols[0]);
      }
      return this.buildBar(rows, cat, numericCols[0]);
    }

    // 1 categorical + N numeric → Grouped bar
    if (categoricalCols.length === 1 && numericCols.length > 1) {
      return this.buildGroupedBar(rows, categoricalCols[0], numericCols);
    }

    // 2 numeric → Scatter plot
    if (numericCols.length === 2 && categoricalCols.length === 0) {
      return this.buildScatter(rows, numericCols[0], numericCols[1]);
    }

    // Fallback → Table
    return this.buildTable(rows, columns);
  }

  private analyzeColumn(
    col: { name: string; dataType: string },
    rows: Record<string, unknown>[],
  ): ColumnAnalysis {
    const values = rows.map((r) => r[col.name]);
    const distinctValues = new Set(values.map(String));
    const type = this.inferType(col.dataType, values);

    return { name: col.name, type, distinctCount: distinctValues.size };
  }

  private inferType(dataType: string, values: unknown[]): ColumnAnalysis['type'] {
    const dt = dataType.toLowerCase();

    if (['date', 'timestamp', 'timestamptz', 'datetime'].some((t) => dt.includes(t))) {
      return 'temporal';
    }

    if (
      ['int', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double', 'float'].some((t) =>
        dt.includes(t),
      )
    ) {
      return 'numeric';
    }

    // Check if values are actually numeric
    if (values.length > 0 && values.every((v) => v !== null && !isNaN(Number(v)))) {
      return 'numeric';
    }

    if (['varchar', 'text', 'char', 'string'].some((t) => dt.includes(t))) {
      return 'categorical';
    }

    return 'unknown';
  }

  private buildKpi(row: Record<string, unknown>, numCol: ColumnAnalysis): ChartRecommendation {
    return {
      chartType: 'kpi',
      config: {
        title: { text: numCol.name },
        series: [{ type: 'kpi', data: [row[numCol.name]] }],
      },
      alternativeTypes: ['table'],
    };
  }

  private buildBar(
    rows: Record<string, unknown>[],
    catCol: ColumnAnalysis,
    numCol: ColumnAnalysis,
  ): ChartRecommendation {
    return {
      chartType: 'bar',
      config: {
        xAxis: { type: 'category', data: rows.map((r) => r[catCol.name]) },
        yAxis: { type: 'value' },
        series: [{ name: numCol.name, type: 'bar', data: rows.map((r) => r[numCol.name]) }],
      },
      alternativeTypes: ['horizontal_bar', 'pie', 'table'],
    };
  }

  private buildHorizontalBar(
    rows: Record<string, unknown>[],
    catCol: ColumnAnalysis,
    numCol: ColumnAnalysis,
  ): ChartRecommendation {
    return {
      chartType: 'horizontal_bar',
      config: {
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: rows.map((r) => r[catCol.name]) },
        series: [{ name: numCol.name, type: 'bar', data: rows.map((r) => r[numCol.name]) }],
      },
      alternativeTypes: ['bar', 'table'],
    };
  }

  private buildLine(
    rows: Record<string, unknown>[],
    timeCol: ColumnAnalysis,
    numCol: ColumnAnalysis,
  ): ChartRecommendation {
    return {
      chartType: 'line',
      config: {
        xAxis: { type: 'category', data: rows.map((r) => r[timeCol.name]) },
        yAxis: { type: 'value' },
        series: [{ name: numCol.name, type: 'line', data: rows.map((r) => r[numCol.name]) }],
      },
      alternativeTypes: ['bar', 'table'],
    };
  }

  private buildMultiLine(
    rows: Record<string, unknown>[],
    timeCol: ColumnAnalysis,
    numCols: ColumnAnalysis[],
  ): ChartRecommendation {
    return {
      chartType: 'multi_line',
      config: {
        xAxis: { type: 'category', data: rows.map((r) => r[timeCol.name]) },
        yAxis: { type: 'value' },
        series: numCols.map((col) => ({
          name: col.name,
          type: 'line',
          data: rows.map((r) => r[col.name]),
        })),
      },
      alternativeTypes: ['grouped_bar', 'table'],
    };
  }

  private buildGroupedBar(
    rows: Record<string, unknown>[],
    catCol: ColumnAnalysis,
    numCols: ColumnAnalysis[],
  ): ChartRecommendation {
    return {
      chartType: 'grouped_bar',
      config: {
        xAxis: { type: 'category', data: rows.map((r) => r[catCol.name]) },
        yAxis: { type: 'value' },
        series: numCols.map((col) => ({
          name: col.name,
          type: 'bar',
          data: rows.map((r) => r[col.name]),
        })),
      },
      alternativeTypes: ['multi_line', 'table'],
    };
  }

  private buildScatter(
    rows: Record<string, unknown>[],
    xCol: ColumnAnalysis,
    yCol: ColumnAnalysis,
  ): ChartRecommendation {
    return {
      chartType: 'scatter',
      config: {
        xAxis: { type: 'value' },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'scatter',
            data: rows.map((r) => [r[xCol.name], r[yCol.name]]),
          },
        ],
      },
      alternativeTypes: ['table'],
    };
  }

  private buildPie(
    rows: Record<string, unknown>[],
    catCol: ColumnAnalysis,
    numCol: ColumnAnalysis,
  ): ChartRecommendation {
    return {
      chartType: 'pie',
      config: {
        series: [
          {
            type: 'pie',
            data: rows.map((r) => ({
              name: r[catCol.name],
              value: r[numCol.name],
            })),
          },
        ],
      },
      alternativeTypes: ['bar', 'table'],
    };
  }

  private buildTable(
    rows: Record<string, unknown>[],
    columns: Array<{ name: string; dataType: string }>,
  ): ChartRecommendation {
    return {
      chartType: 'table',
      config: {
        series: [
          {
            type: 'table',
            data: rows,
          },
        ],
      },
      alternativeTypes: columns.length >= 2 ? ['bar'] : [],
    };
  }
}
