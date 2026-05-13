import { describe, expect, it } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { CodingTaskRunner } from '../src/dsxu/engine/coding-task-runner';

const tempDir = resolve('.dsxu/tmp-tests');
const taskPath = join(tempDir, 'coding-task.md');
const runsDir = join(tempDir, 'runs');

const taskContent = `# Fix DSxu task runner

## Goal
- Stabilize the coding task execution path for local development.

## Acceptance Criteria
- Task parser reads title, goal, files, and verify commands.
- Run record is created locally.

## Files
- src/dsxu/engine/coding-task-runner.ts
- src/dsxu/engine/coding-cli.ts

## Verify
- bun test test/coding-task-runner.test.ts
- bun run src/dsxu/engine/coding-cli.ts inspect .dsxu/tasks/seed-5.md

## Constraints
- Keep the implementation local-first.

## Notes
- This is a bootstrap task for DSxu coding workflows.
`;

describe('CodingTaskRunner', () => {
  it('parses task markdown into a structured spec', () => {
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(taskPath, taskContent, 'utf8');

    const runner = new CodingTaskRunner(runsDir);
    const task = runner.loadTask(taskPath);

    expect(task.title).toBe('Fix DSxu task runner');
    expect(task.goal).toContain('Stabilize the coding task execution path');
    expect(task.acceptanceCriteria).toHaveLength(2);
    expect(task.files).toHaveLength(2);
    expect(task.verifyCommands).toHaveLength(2);
  });

  it('creates a local run record', () => {
    const runner = new CodingTaskRunner(runsDir);
    const task = runner.loadTask(taskPath);
    const record = runner.createRunRecord(task);
    const recordPath = join(runsDir, `${record.id}.json`);
    const saved = JSON.parse(readFileSync(recordPath, 'utf8'));

    expect(saved.title).toBe(task.title);
    expect(saved.status).toBe('pending');
    expect(saved.verifyCommands).toEqual(task.verifyCommands);
  });

  it('flags incomplete task files', () => {
    const brokenPath = join(tempDir, 'broken-task.md');
    writeFileSync(
      brokenPath,
      `# Broken Task

## Goal
- Missing most required sections.
`,
      'utf8',
    );

    const runner = new CodingTaskRunner(runsDir);
    const issues = runner.validateTask(runner.loadTask(brokenPath));

    expect(issues.length).toBeGreaterThan(0);
    expect(issues).toContain('Acceptance criteria are missing.');
  });
});
