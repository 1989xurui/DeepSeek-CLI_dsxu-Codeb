import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runQuery } from '../src/dsxu/engine/query-loop'
import type { QueryEngineConfig, ToolResult } from '../src/dsxu/engine/types'
import { QUERY_LOOP_CAPTURE_ENV } from '../src/dsxu/training/query-loop-capture'

interface CliArgs {
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_CAPTURE_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const outputPath = resolve(args.output)
  const oldCapturePath = process.env[QUERY_LOOP_CAPTURE_ENV]
  process.env[QUERY_LOOP_CAPTURE_ENV] = outputPath
  try {
    const result = await runQuery(
      buildConfig(),
      [{ role: 'user', content: 'Run opt-in query-loop training capture smoke.' }],
      buildRegistry() as any,
      {
        sessionId: 'training-query-loop-capture-smoke-session',
        requestId: 'training-query-loop-capture-smoke-request',
        taskQuery: 'Run opt-in query-loop training capture smoke.',
      },
    )
    if (!existsSync(outputPath)) throw new Error(`capture artifact was not written: ${outputPath}`)
    const artifact = JSON.parse(await readFile(outputPath, 'utf8')) as any
    console.log(JSON.stringify({
      schemaVersion: artifact.schemaVersion,
      output: outputPath,
      resultExitReason: result.exitReason,
      validationStatus: artifact.validation?.status,
      scoreStatus: artifact.score?.status,
      averageSees: artifact.score?.scores?.sees,
      eventCount: artifact.capture?.eventCount,
      publicClaimAllowed: artifact.publicClaimAllowed,
    }, null, 2))
    if (
      result.exitReason !== 'end_turn' ||
      artifact.validation?.status !== 'accepted' ||
      artifact.score?.status !== 'scored' ||
      artifact.publicClaimAllowed !== false
    ) {
      process.exit(1)
    }
  } finally {
    if (oldCapturePath === undefined) {
      delete process.env[QUERY_LOOP_CAPTURE_ENV]
    } else {
      process.env[QUERY_LOOP_CAPTURE_ENV] = oldCapturePath
    }
  }
}

function buildConfig(): QueryEngineConfig {
  let callCount = 0
  return {
    cwd: process.cwd(),
    maxTurns: 3,
    toolExecution: { mode: 'sequential' },
    sessionSummary: { enabled: false },
    sessionMemory: { enabled: false },
    memoryExtraction: { enabled: false },
    agentSummary: { enabled: false },
    llmCall: async () => {
      callCount += 1
      if (callCount === 1) {
        return {
          content: 'I will read source truth and run verification.',
          stopReason: 'tool_use',
          toolCalls: [
            {
              id: 'smoke-read-1',
              name: 'Read',
              arguments: { file_path: 'src/dsxu/engine/query-loop.ts' },
            },
            {
              id: 'smoke-bash-1',
              name: 'Bash',
              arguments: { command: 'bun test src/dsxu/training/__tests__/query-loop-capture.test.ts' },
            },
          ],
          usage: {
            inputTokens: 880,
            outputTokens: 130,
            cacheHit: true,
            cacheReadTokens: 690,
            cacheCreationTokens: 75,
          },
        }
      }
      return {
        content: 'Opt-in query-loop capture smoke passed.',
        stopReason: 'end_turn',
        toolCalls: [],
        usage: {
          inputTokens: 390,
          outputTokens: 54,
          cacheHit: true,
          cacheReadTokens: 340,
          cacheCreationTokens: 0,
        },
      }
    },
  }
}

function buildRegistry() {
  const schemas = [
    {
      name: 'Read',
      description: 'Read source truth',
      inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
    },
    {
      name: 'Bash',
      description: 'Run verification',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  ]
  return {
    getAll: () => schemas,
    get: (name: string) => schemas.find(schema => schema.name === name),
    has: (name: string) => schemas.some(schema => schema.name === name),
    register: () => {},
    unregister: () => {},
    clear: () => {},
    size: schemas.length,
    getSchemas: () => schemas,
    execute: async (name: string, input: Record<string, unknown>, toolUseId: string): Promise<ToolResult> => ({
      toolUseId,
      content: name === 'Bash'
        ? `PASS ${String(input.command ?? 'verification')}`
        : `SOURCE_SUMMARY ${String(input.file_path ?? 'unknown')}`,
      isError: false,
      meta: {
        durationMs: 6,
        executorKind: 'dsxu_native',
        usedBridge: false,
      },
    }),
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
