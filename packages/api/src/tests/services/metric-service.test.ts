import { describe, it, expect, beforeEach } from 'vitest';
import { MetricService } from '../../services/metric-service.js';
import { ProjectService } from '../../services/project-service.js';
import { getTestDb } from '../setup.js';
import { metrics, projects } from '@nl2sql/db';

describe('MetricService', () => {
  let service: MetricService;
  let projectId: string;

  beforeEach(async () => {
    const db = getTestDb();
    await db.delete(metrics);
    await db.delete(projects);
    service = new MetricService(db);

    const project = await new ProjectService(db).create({ name: 'Test' });
    projectId = project.id;
  });

  it('creates an atomic metric', async () => {
    const result = await service.create({
      projectId,
      name: 'gmv',
      displayName: '成交总额',
      expression: 'SUM(order_amount)',
      metricType: 'atomic',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
      dimensions: ['region', 'category'],
      granularity: ['day', 'week', 'month'],
      format: 'currency',
    });

    expect(result.name).toBe('gmv');
    expect(result.displayName).toBe('成交总额');
    expect(result.metricType).toBe('atomic');
    expect(result.format).toBe('currency');
  });

  it('creates a derived metric', async () => {
    const base1 = await service.create({
      projectId,
      name: 'paying_users',
      displayName: '付费用户数',
      expression: 'COUNT(DISTINCT user_id)',
      metricType: 'atomic',
      format: 'number',
    });

    const base2 = await service.create({
      projectId,
      name: 'active_users',
      displayName: '活跃用户数',
      expression: 'COUNT(DISTINCT user_id)',
      metricType: 'atomic',
      format: 'number',
    });

    const derived = await service.create({
      projectId,
      name: 'conversion_rate',
      displayName: '转化率',
      expression: 'paying_users / active_users',
      metricType: 'derived',
      derivedFrom: [base1.id, base2.id],
      format: 'percentage',
    });

    expect(derived.metricType).toBe('derived');
    expect(derived.derivedFrom).toEqual([base1.id, base2.id]);
  });

  it('lists metrics by project', async () => {
    await service.create({
      projectId,
      name: 'metric1',
      displayName: 'M1',
      expression: 'COUNT(*)',
      metricType: 'atomic',
      format: 'number',
    });
    await service.create({
      projectId,
      name: 'metric2',
      displayName: 'M2',
      expression: 'SUM(amount)',
      metricType: 'atomic',
      format: 'number',
    });

    const list = await service.listByProject(projectId);
    expect(list).toHaveLength(2);
  });

  it('finds metric by name', async () => {
    await service.create({
      projectId,
      name: 'gmv',
      displayName: 'GMV',
      expression: 'SUM(amount)',
      metricType: 'atomic',
      format: 'number',
    });

    const found = await service.findByName(projectId, 'gmv');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('gmv');
  });

  it('composes SQL from metric definition', async () => {
    const metric = await service.create({
      projectId,
      name: 'gmv',
      displayName: 'GMV',
      expression: 'SUM(order_amount)',
      metricType: 'atomic',
      format: 'currency',
      filters: [{ column: 'status', op: '=', value: 'completed' }],
    });

    const sql = service.composeSql(metric, {
      dimensions: ['region'],
      timeColumn: 'order_date',
      timeRange: { start: '2026-03-01', end: '2026-04-01' },
      orderBy: 'gmv DESC',
      limit: 10,
    });

    expect(sql).toContain('SUM(order_amount) AS gmv');
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain("order_date >= '2026-03-01'");
    expect(sql).toContain('GROUP BY region');
    expect(sql).toContain('ORDER BY gmv DESC');
    expect(sql).toContain('LIMIT 10');
  });

  it('deletes a metric', async () => {
    const created = await service.create({
      projectId,
      name: 'temp',
      displayName: 'Temp',
      expression: 'COUNT(*)',
      metricType: 'atomic',
      format: 'number',
    });
    const deleted = await service.remove(created.id);
    expect(deleted).toBe(true);
  });
});
