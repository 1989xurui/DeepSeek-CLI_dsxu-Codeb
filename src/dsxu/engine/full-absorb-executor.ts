import type {
  FullAbsorbExecutionReport,
  FullAbsorbStatus,
  FullAbsorbWaveResult,
  ToolSchema,
} from './types'
import { buildFullAbsorbActions } from './full-absorb'

export function executeFullAbsorbPlan(input: {
  status: FullAbsorbStatus
  importedTools: number
  toolSchemas: ToolSchema[]
  reduceTestStrategy?: 'minimal' | 'standard'
}): FullAbsorbExecutionReport {
  const startedAt = new Date().toISOString()
  const actions = buildFullAbsorbActions(input.status)
  const waves: FullAbsorbWaveResult[] = actions.map(action => {
    const tracks = action.items.map(item => ({
      track: item,
      done: !item.includes('->'),
      evidence: [item],
    }))
    const doneCount = tracks.filter(t => t.done).length
    return {
      wave: action.wave,
      title: action.title,
      doneCount,
      totalCount: tracks.length,
      tracks,
    }
  })

  if (waves.length === 0) {
    waves.push({
      wave: 'W1',
      title: 'Full Absorb Completed',
      doneCount: 1,
      totalCount: 1,
      tracks: [{ track: 'All targets complete', done: true, evidence: ['scanFullAbsorbStatus ratio=1'] }],
    })
  }

  const recommendedTests =
    input.reduceTestStrategy === 'standard'
      ? [
          'bun test ./src/dsxu/engine/__tests__',
        ]
      : [
          'bun test ./src/dsxu/engine/__tests__/engine.test.ts',
          'bun test ./src/dsxu/engine/__tests__/full-absorb.test.ts',
          'bun test ./src/dsxu/engine/__tests__/mcp-client.test.ts ./src/dsxu/engine/__tests__/lsp-tool.test.ts',
          'bun test ./src/dsxu/engine/__tests__/wave5-telemetry.test.ts',
        ]

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    status: input.status,
    importedTools: input.importedTools,
    totalTools: input.toolSchemas.length,
    waves,
    recommendedTests,
  }
}

