/**
 * DSxu HITL (Human-In-The-Loop) 事件上报框架
 *
 * 当自动流程遇到以下情况时上报 incident：
 * - G1 测试失败且自动修复超过 3 次
 * - G2/G3 评分骤降
 * - A/B gap 突然恶化
 * - 成本超预算
 * - 未知错误
 *
 * 事件写入 .dsevo/incidents/ 并可选发送通知
 */

import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';

// ── 类型 ──

export type IncidentSeverity = 'info' | 'warning' | 'critical';
export type IncidentCategory =
  | 'test-failure'
  | 'eval-regression'
  | 'cost-overrun'
  | 'ab-regression'
  | 'runtime-error'
  | 'timeout';

export interface Incident {
  id: string;
  timestamp: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  module: string;
  summary: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

export interface HitlConfig {
  incidentDir?: string;
  /** Mock mode: don't write to disk */
  mockMode?: boolean;
  /** Optional notification callback */
  onNotify?: (incident: Incident) => Promise<void>;
}

// ── Reporter ──

export class IncidentReporter {
  private config: HitlConfig;
  private incidentDir: string;
  private memoryStore: Map<string, Incident> = new Map();

  constructor(config?: HitlConfig) {
    this.config = config ?? {};
    this.incidentDir = config?.incidentDir ?? '.dsevo/incidents';
  }

  async report(incident: Omit<Incident, 'id' | 'timestamp' | 'resolved'>): Promise<Incident> {
    const full: Incident = {
      ...incident,
      id: `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.memoryStore.set(full.id, full);

    if (!this.config.mockMode) {
      await mkdir(this.incidentDir, { recursive: true });
      await writeFile(
        join(this.incidentDir, `${full.id}.json`),
        JSON.stringify(full, null, 2)
      );
    }

    if (this.config.onNotify) {
      await this.config.onNotify(full);
    }

    return full;
  }

  async resolve(incidentId: string, resolution: string): Promise<Incident | null> {
    const incident = this.memoryStore.get(incidentId);
    if (!incident) return null;

    incident.resolved = true;
    incident.resolvedAt = new Date().toISOString();
    incident.resolution = resolution;

    if (!this.config.mockMode) {
      await writeFile(
        join(this.incidentDir, `${incidentId}.json`),
        JSON.stringify(incident, null, 2)
      );
    }

    return incident;
  }

  async list(opts?: { resolved?: boolean; category?: IncidentCategory }): Promise<Incident[]> {
    let incidents = Array.from(this.memoryStore.values());

    if (opts?.resolved !== undefined) {
      incidents = incidents.filter(i => i.resolved === opts.resolved);
    }
    if (opts?.category) {
      incidents = incidents.filter(i => i.category === opts.category);
    }

    return incidents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  async stats(): Promise<{
    total: number;
    open: number;
    resolved: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const all = Array.from(this.memoryStore.values());
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const i of all) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
      byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    }

    return {
      total: all.length,
      open: all.filter(i => !i.resolved).length,
      resolved: all.filter(i => i.resolved).length,
      bySeverity,
      byCategory,
    };
  }
}

// ── 便捷函数 ──

/** 快速上报测试失败 */
export function reportTestFailure(reporter: IncidentReporter, module: string, details: Record<string, any>) {
  return reporter.report({
    severity: 'warning',
    category: 'test-failure',
    module,
    summary: `Test failure in ${module}`,
    details,
  });
}

/** 快速上报成本超预算 */
export function reportCostOverrun(reporter: IncidentReporter, module: string, actual: number, budget: number) {
  return reporter.report({
    severity: 'critical',
    category: 'cost-overrun',
    module,
    summary: `Cost overrun in ${module}: $${actual.toFixed(2)} > budget $${budget.toFixed(2)}`,
    details: { actual, budget, overage: actual - budget },
  });
}
