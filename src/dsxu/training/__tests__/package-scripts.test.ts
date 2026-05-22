import { describe, expect, it } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const requiredScripts = {
  'training:test': 'bun test src/dsxu/training/__tests__',
  'training:export': 'bun run scripts/dsxu-training-export.ts --dry-run',
  'training:validate': 'bun run scripts/dsxu-training-validate.ts',
  'training:score': 'bun run scripts/dsxu-training-score.ts',
  'training:golden': 'bun run scripts/dsxu-training-generate-golden.ts',
  'training:replay': 'bun run scripts/dsxu-training-generate-replay.ts',
  'training:ablation': 'bun run scripts/dsxu-training-ablation.ts',
  'training:export-runtime': 'bun run scripts/dsxu-training-export-runtime.ts',
  'training:capture': 'bun run scripts/dsxu-training-capture.ts',
  'training:reachability': 'bun run scripts/dsxu-training-query-loop-reachability.ts',
  'training:capture-query-loop': 'bun run scripts/dsxu-training-query-loop-capture-smoke.ts',
  'training:live-provider-capture': 'bun run scripts/dsxu-training-live-provider-capture.ts',
  'training:dashboard': 'bun run scripts/dsxu-training-dashboard.ts',
  'training:v1': 'bun run scripts/dsxu-training-v1-runner.ts',
} as const

describe('training package scripts', () => {
  it('keeps the documented training entrypoints wired in package.json', async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }

    for (const [name, command] of Object.entries(requiredScripts)) {
      expect(packageJson.scripts?.[name]).toBe(command)
    }
  })
})
