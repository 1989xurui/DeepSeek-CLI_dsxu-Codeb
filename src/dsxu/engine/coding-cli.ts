#!/usr/bin/env bun
import { CodingTaskRunner } from './coding-task-runner';

function printHelp(): void {
  console.log(`
DSxu Coding Task CLI

Usage:
  bun run src/dsxu/engine/coding-cli.ts inspect <task-file>
  bun run src/dsxu/engine/coding-cli.ts brief <task-file>
  bun run src/dsxu/engine/coding-cli.ts start <task-file>

Commands:
  inspect  Parse a coding task file and report missing fields
  brief    Print an execution brief for a coding task
  start    Create a local run record for the task
`);
}

async function main() {
  const [command, taskFile] = process.argv.slice(2);

  if (!command || !taskFile) {
    printHelp();
    process.exit(command ? 1 : 0);
  }

  const runner = new CodingTaskRunner();
  const task = runner.loadTask(taskFile);

  switch (command) {
    case 'inspect': {
      const issues = runner.validateTask(task);
      console.log(`Task: ${task.title}`);
      if (issues.length === 0) {
        console.log('Task file is valid.');
      } else {
        console.log('Task file issues:');
        issues.forEach(issue => console.log(`- ${issue}`));
        process.exit(1);
      }
      break;
    }

    case 'brief':
      console.log(runner.buildExecutionBrief(task));
      break;

    case 'start': {
      const issues = runner.validateTask(task);
      if (issues.length > 0) {
        console.log('Task file issues:');
        issues.forEach(issue => console.log(`- ${issue}`));
        process.exit(1);
      }

      const record = runner.createRunRecord(task);
      console.log(`Run record created: ${record.id}`);
      console.log(`Task: ${record.title}`);
      break;
    }

    default:
      printHelp();
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
