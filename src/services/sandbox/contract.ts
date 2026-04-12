/**
 * R5-27 WSL2 沙箱桥 — 类型契约
 */

export interface SandboxOptions {
  workspaceDir: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;      // 默认 30000
  network?: 'none' | 'host';
  cpuPct?: number;         // 默认 50
  memMb?: number;          // 默认 2048
}

export interface SandboxResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  oomKilled: boolean;
  timedOut: boolean;
}

export interface SandboxConfig {
  /** Mock sandbox for G4 testing */
  mockRunner?: (opts: SandboxOptions) => Promise<SandboxResult>;
}
