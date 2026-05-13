import { describe, expect, test } from 'bun:test';
import { createToolMainlineExecutor } from '../tool-mainline-runtime-v1';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('C05 tool compatibility absorption clean', () => {
  const executor = createToolMainlineExecutor();

  const baseContext = {
    sessionId: 'c05-compat-session',
    cwd: process.cwd(),
    allowedPermissionLevel: 'privileged' as const,
    requireConfirmationForWrite: false,
    denyRules: [],
  };

  test('PowerShellTool alias routes to Bash runtime', async () => {
    const out = await executor.execute({
      toolId: 'PowerShellTool',
      input: { command: 'echo dsxu-compat' },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content.toLowerCase()).toContain('dsxu-compat');
  });

  test('TaskCreateTool routes into Agent lifecycle create action', async () => {
    const out = await executor.execute({
      toolId: 'TaskCreateTool',
      input: { taskId: 'task-c05-1', title: 'compat-create' },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('agent-action=create');
    expect(out.result?.content).toContain('task-c05-1');
  });

  test('TaskStopTool routes into Agent lifecycle stop action', async () => {
    await executor.execute({
      toolId: 'TaskCreateTool',
      input: { taskId: 'task-c05-2', title: 'to-stop' },
      context: baseContext,
    });

    const out = await executor.execute({
      toolId: 'TaskStopTool',
      input: { taskId: 'task-c05-2' },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('agent-action=stop');
  });

  test('ReadTool alias remains executable in mainline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsxu-c05-'));
    const file = join(dir, 'sample.txt');
    writeFileSync(file, 'line-a\nline-b\n', 'utf8');

    const out = await executor.execute({
      toolId: 'ReadTool',
      input: { file_path: file },
      context: { ...baseContext, cwd: dir },
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('line-a');
  });

  test('EnterPlanModeTool routes to AgentTool message action', async () => {
    const out = await executor.execute({
      toolId: 'EnterPlanModeTool',
      input: { taskId: 'task-c05-plan', message: 'enter-plan' },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('agent-action=message');
    expect(out.result?.content).toContain('task-c05-plan');
  });
});
