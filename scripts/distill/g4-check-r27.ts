/**
 * R5-27 WSL2 沙箱桥 — G4 蒸馏校验器
 * 用法: bun run scripts/distill/g4-check-r27.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/sandbox'));
  const { checkWslAvailable, runInSandbox } = mod;
  let passed = 0, failed = 0;

  function check(id: string, ok: boolean, msg = '') {
    if (ok) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // checkWslAvailable with mock
  const available = await checkWslAvailable({ mockRunner: async () => ({ exitCode: 0, stdout: '', stderr: '', durationMs: 0, oomKilled: false, timedOut: false }) });
  check('wsl-01', available === true, 'mock should return true');

  // runInSandbox: happy path
  const r1 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'echo', args: ['hello'], timeoutMs: 5000 },
    { mockRunner: async (opts) => ({ exitCode: 0, stdout: 'hello\n', stderr: '', durationMs: 50, oomKilled: false, timedOut: false }) }
  );
  check('run-01', r1.exitCode === 0, `exitCode should be 0, got ${r1.exitCode}`);
  check('run-02', r1.stdout === 'hello\n', 'stdout mismatch');
  check('run-03', !r1.timedOut, 'should not timeout');

  // runInSandbox: timeout
  const r2 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'sleep', args: ['100'], timeoutMs: 1000 },
    { mockRunner: async () => ({ exitCode: 137, stdout: '', stderr: 'timeout', durationMs: 1000, oomKilled: false, timedOut: true }) }
  );
  check('run-04', r2.timedOut, 'should be timed out');
  check('run-05', r2.exitCode !== 0, 'exit code should be non-zero');

  // runInSandbox: OOM
  const r3 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'oom-program', args: [], memMb: 256 },
    { mockRunner: async () => ({ exitCode: 137, stdout: '', stderr: 'OOM killed', durationMs: 500, oomKilled: true, timedOut: false }) }
  );
  check('run-06', r3.oomKilled, 'should be OOM killed');

  // runInSandbox: network none (malicious curl)
  const r4 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'curl', args: ['http://evil.com'], network: 'none' },
    { mockRunner: async (opts) => {
      const blocked = opts.network === 'none';
      return { exitCode: blocked ? 7 : 0, stdout: '', stderr: blocked ? 'Connection refused' : '', durationMs: 100, oomKilled: false, timedOut: false };
    }}
  );
  check('run-07', r4.exitCode !== 0, 'network=none should block curl');
  check('run-08', r4.stderr.includes('refused') || r4.stderr.includes('blocked'), 'should indicate network blocked');

  // runInSandbox: malicious rm
  const r5 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'rm', args: ['-rf', '/'] },
    { mockRunner: async () => ({ exitCode: 1, stdout: '', stderr: 'permission denied', durationMs: 10, oomKilled: false, timedOut: false }) }
  );
  check('run-09', r5.exitCode !== 0, 'malicious rm should fail');

  // env vars
  const r6 = await runInSandbox(
    { workspaceDir: 'D:\\test', command: 'env', args: [], env: { MY_VAR: 'test123' } },
    { mockRunner: async (opts) => ({ exitCode: 0, stdout: `MY_VAR=${opts.env?.MY_VAR ?? ''}`, stderr: '', durationMs: 10, oomKilled: false, timedOut: false }) }
  );
  check('run-10', r6.stdout.includes('test123'), 'env vars should be passed');

  console.log(`\n  R5-27 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main();
