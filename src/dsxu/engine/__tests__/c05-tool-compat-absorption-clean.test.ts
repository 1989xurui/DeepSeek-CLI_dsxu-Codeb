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

  test('TaskCreateTool alias executes the real mainline TaskCreate tool', async () => {
    const previousTaskListId = process.env.DSXU_CODE_TASK_LIST_ID;
    process.env.DSXU_CODE_TASK_LIST_ID = `c05-task-mainline-${Date.now()}`;
    try {
      const out = await executor.execute({
        toolId: 'TaskCreateTool',
        input: {
          subject: 'compat-create',
          description: 'Verify TaskCreateTool lands on the real task owner.',
          activeForm: 'Verifying TaskCreate owner',
          metadata: { source: 'c05-tool-compat' },
        },
        context: baseContext,
      });

      expect(out.allowed).toBeTrue();
      expect(out.result?.content).toContain('Task #1 created successfully');
      expect(out.result?.content).not.toContain('agent-action=');
    } finally {
      if (previousTaskListId === undefined) {
        delete process.env.DSXU_CODE_TASK_LIST_ID;
      } else {
        process.env.DSXU_CODE_TASK_LIST_ID = previousTaskListId;
      }
    }
  });

  test('TaskStopTool alias does not fall back to local Agent lifecycle simulation', async () => {
    const out = await executor.execute({
      toolId: 'TaskStopTool',
      input: { task_id: 'missing-c05-task' },
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.isError).toBeTrue();
    expect(out.result?.content).toContain('No task found with ID: missing-c05-task');
    expect(out.result?.content).not.toContain('agent-action=');
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

  test('EnterPlanModeTool alias executes the real plan-mode owner', async () => {
    const out = await executor.execute({
      toolId: 'EnterPlanModeTool',
      input: {},
      context: baseContext,
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.content).toContain('Entered plan mode');
    expect(out.result?.content).not.toContain('agent-action=');
  });
});
