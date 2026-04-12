/**
 * R5-27 WSL2 沙箱 — 主入口
 */

import type { SandboxOptions, SandboxResult, SandboxConfig } from './contract';

/**
 * 检查 WSL2 是否可用
 */
export async function checkWslAvailable(
  config?: SandboxConfig
): Promise<boolean> {
  if (config?.mockRunner) return true;

  try {
    const { execSync } = await import('child_process');
    const output = execSync('wsl --status', { encoding: 'utf-8', timeout: 5000 });
    return output.includes('WSL') || output.includes('wsl');
  } catch {
    return false;
  }
}

/**
 * 在 WSL2 沙箱中运行命令
 */
export async function runInSandbox(
  opts: SandboxOptions,
  config?: SandboxConfig
): Promise<SandboxResult> {
  if (config?.mockRunner) {
    return config.mockRunner(opts);
  }

  const startTime = Date.now();
  const timeout = opts.timeoutMs ?? 30_000;

  // 构建 WSL 命令
  const envExports = Object.entries(opts.env ?? {})
    .map(([k, v]) => `export ${k}="${v}"`)
    .join(' && ');

  const fullCmd = [
    envExports ? `${envExports} &&` : '',
    `cd /mnt/${opts.workspaceDir.replace(/\\/g, '/').replace(/^(\w):/, (_, d) => d.toLowerCase())} &&`,
    opts.command,
    ...opts.args,
  ].filter(Boolean).join(' ');

  const wslArgs = [
    '--distribution', 'Ubuntu',
    '--exec', 'bash', '-c',
    `ulimit -v ${(opts.memMb ?? 2048) * 1024} && ${fullCmd}`,
  ];

  try {
    const { execSync } = await import('child_process');
    const stdout = execSync(`wsl ${wslArgs.join(' ')}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout,
      stderr: '',
      durationMs: Date.now() - startTime,
      oomKilled: false,
      timedOut: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const timedOut = durationMs >= timeout * 0.95;
    const oomKilled = err.message?.includes('OOM') || err.message?.includes('memory');

    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? '',
      durationMs,
      oomKilled,
      timedOut,
    };
  }
}
