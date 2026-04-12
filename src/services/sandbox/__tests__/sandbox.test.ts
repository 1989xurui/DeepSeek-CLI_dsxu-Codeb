import { describe, test, expect } from 'bun:test';
import { checkWslAvailable, runInSandbox } from '../index';
import type { SandboxOptions, SandboxResult, SandboxConfig } from '../contract';

function makeOpts(overrides: Partial<SandboxOptions> = {}): SandboxOptions {
  return {
    workspaceDir: '/tmp/workspace',
    command: 'echo',
    args: ['hello'],
    ...overrides,
  };
}

function mockConfig(fn: (opts: SandboxOptions) => Promise<SandboxResult>): SandboxConfig {
  return { mockRunner: fn };
}

describe('R5-27 WSL2 Sandbox', () => {
  test('checkWslAvailable returns true with mock', async () => {
    const available = await checkWslAvailable({ mockRunner: async () => ({ exitCode: 0, stdout: '', stderr: '', durationMs: 0, oomKilled: false, timedOut: false }) });
    expect(available).toBe(true);
  });

  test('happy path: command runs successfully', async () => {
    const config = mockConfig(async (opts) => ({
      exitCode: 0,
      stdout: 'hello\n',
      stderr: '',
      durationMs: 50,
      oomKilled: false,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts(), config);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\n');
    expect(result.timedOut).toBe(false);
    expect(result.oomKilled).toBe(false);
  });

  test('timeout scenario', async () => {
    const config = mockConfig(async (opts) => ({
      exitCode: 124,
      stdout: '',
      stderr: 'timeout',
      durationMs: 30000,
      oomKilled: false,
      timedOut: true,
    }));
    const result = await runInSandbox(makeOpts({ timeoutMs: 30000 }), config);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  test('OOM killed scenario', async () => {
    const config = mockConfig(async () => ({
      exitCode: 137,
      stdout: '',
      stderr: 'OOM',
      durationMs: 100,
      oomKilled: true,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts({ memMb: 512 }), config);
    expect(result.oomKilled).toBe(true);
    expect(result.exitCode).toBe(137);
  });

  test('network blocked returns result', async () => {
    const config = mockConfig(async (opts) => ({
      exitCode: 1,
      stdout: '',
      stderr: 'network unreachable',
      durationMs: 10,
      oomKilled: false,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts({ network: 'none' }), config);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('network');
  });

  test('malicious rm command still returns result via mock', async () => {
    const config = mockConfig(async (opts) => ({
      exitCode: 1,
      stdout: '',
      stderr: 'permission denied',
      durationMs: 5,
      oomKilled: false,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts({ command: 'rm', args: ['-rf', '/'] }), config);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('permission denied');
  });

  test('env vars are passed through', async () => {
    const config = mockConfig(async (opts) => ({
      exitCode: 0,
      stdout: opts.env?.MY_VAR ?? '',
      stderr: '',
      durationMs: 10,
      oomKilled: false,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts({ env: { MY_VAR: 'test123' } }), config);
    expect(result.stdout).toBe('test123');
  });

  test('durationMs is reported', async () => {
    const config = mockConfig(async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
      durationMs: 42,
      oomKilled: false,
      timedOut: false,
    }));
    const result = await runInSandbox(makeOpts(), config);
    expect(result.durationMs).toBe(42);
  });
});
