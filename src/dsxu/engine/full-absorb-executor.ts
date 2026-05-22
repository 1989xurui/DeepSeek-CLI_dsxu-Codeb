import { buildFullAbsorbActions, type FullAbsorbStatus } from './full-absorb'

export function executeFullAbsorbPlan(input: {
  status: FullAbsorbStatus
  importedTools: number
  toolSchemas: unknown[]
  reduceTestStrategy: 'focused' | 'full'
}) {
  return {
    status: input.status,
    actions: buildFullAbsorbActions(input.status),
    importedTools: input.importedTools,
    toolSchemaCount: input.toolSchemas.length,
    recommendedTests:
      input.reduceTestStrategy === 'focused'
        ? ['bun test src/dsxu/engine/__tests__/full-absorb.test.ts']
        : ['bun test', 'bun run test:six-stage-final'],
  }
}
