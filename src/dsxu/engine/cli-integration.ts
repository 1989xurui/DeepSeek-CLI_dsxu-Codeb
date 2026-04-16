#!/usr/bin/env bun
import { OpportunityTaskRunner } from './task-runner';

/**
 * CLI interface for the opportunity discovery system.
 *
 * Usage:
 *   bun run src/dsxu/engine/cli-integration.ts [command]
 */

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const runner = new OpportunityTaskRunner();

  switch (command) {
    case 'run':
      await runner.runDiscovery();
      break;

    case 'schedule': {
      const intervalHours = args[1] ? Number.parseInt(args[1], 10) : 24;
      await runner.runScheduled(intervalHours);
      break;
    }

    case 'test':
      console.log('Running opportunity discovery self-check...');
      await runTests();
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function runTests(): Promise<void> {
  const runner = new OpportunityTaskRunner();

  try {
    await runner.runDiscovery();
    console.log('Self-check completed successfully.');
  } catch (error) {
    console.error('Self-check failed:', error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Opportunity Discovery System CLI

Usage:
  bun run src/dsxu/engine/cli-integration.ts [command] [options]

Commands:
  run              Run one-time opportunity discovery
  schedule [hours] Run discovery on schedule (default: 24 hours)
  test             Run a lightweight self-check
  help             Show this help message

Examples:
  bun run src/dsxu/engine/cli-integration.ts run
  bun run src/dsxu/engine/cli-integration.ts schedule 12
  bun run src/dsxu/engine/cli-integration.ts test
`);
}

if (import.meta.main) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
