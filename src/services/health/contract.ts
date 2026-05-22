export type HealthCategory = 'tool' | 'permission' | 'model' | 'environment' | 'cache';
export type HealthSeverity = 'critical' | 'warning' | 'info';
export type HealthStatus = 'PASS' | 'FAIL' | 'WARN';

export interface HealthCheck {
  name: string;
  category: HealthCategory;
  severity: HealthSeverity;
  run(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  name: string;
  category: HealthCategory;
  severity: HealthSeverity;
  status: HealthStatus;
  message: string;
  detail?: string;
  durationMs: number;
}

export interface HealthReport {
  overall: 'PASS' | 'FAIL' | 'DEGRADED';
  checks: HealthCheckResult[];
  generatedAt: string;
}
