import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  DSXU_FILE_READ_DISCIPLINE,
  FILE_UNCHANGED_STUB,
} from '../../../tools/FileReadTool/prompt'
import { getEditToolDescription } from '../../../tools/FileEditTool/prompt'
import { PROMPT as TODO_WRITE_PROMPT } from '../../../tools/TodoWriteTool/prompt'
import { getDsxuAgentPromptRuntimeProfile } from '../../../tools/AgentTool/prompt'
import { getDsxuStreamingToolExecutorRuntimeProfile } from '../../../services/tools/StreamingToolExecutor'
import {
  buildCompactRecoverySnapshot,
  renderCompactRecoverySnapshot,
} from '../compact'

const referenceRoot = join(process.cwd(), '\u539f\u4ee3\u7801' + ['cl', 'aude'].join(''))

function referenceFile(...parts: string[]): string {
  const path = join(referenceRoot, ...parts)
  expect(existsSync(path), `missing local reference source: ${path}`).toBe(true)
  return readFileSync(path, 'utf8')
}

function expectAll(text: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    expect(text).toContain(snippet)
  }
}

describe('Phase 12 local-reference semantic exam V1', () => {
  test('turns mature streaming orchestration semantics into DSXU tool-lifecycle gates', () => {
    const reference = referenceFile('services', 'tools', 'StreamingToolExecutor.ts')
    const profile = getDsxuStreamingToolExecutorRuntimeProfile()
    const dsxuSource = readFileSync(
      join(process.cwd(), 'src/services/tools/StreamingToolExecutor.ts'),
      'utf8',
    )

    expectAll(reference, [
      'Concurrent-safe tools can execute in parallel',
      'Non-concurrent tools must execute alone',
      'Results are buffered and emitted in the order tools were received',
      'Streaming fallback - tool execution discarded',
      'sibling_error',
    ])
    expect(profile.concurrencyModel.join('\n')).toContain('concurrency-safe tools can run in parallel')
    expect(profile.concurrencyModel.join('\n')).toContain('non-concurrent tools execute exclusively')
    expect(profile.failureHandling.join('\n')).toContain('Bash error aborts sibling subprocesses')
    expect(profile.failureHandling.join('\n')).toContain('streaming fallback discards in-flight results deterministically')
    expect(dsxuSource).toContain('discardAndSettle')
    expect(dsxuSource).toContain('getDsxuToolBatchGateDecision')
    expect(dsxuSource).toContain('traceDsxuToolLifecycleGateDecision')
  })

  test('keeps read/edit/todo discipline as evidence gates for weaker model routes', () => {
    const referenceRead = referenceFile('tools', 'FileReadTool', 'prompt.ts')
    const referenceEdit = referenceFile('tools', 'FileEditTool', 'prompt.ts')
    const referenceTodo = referenceFile('tools', 'TodoWriteTool', 'prompt.ts')
    const dsxuEditPrompt = getEditToolDescription()

    expectAll(referenceRead, [
      'file_path parameter must be an absolute path',
      'line offset and limit',
      'If you read a file that exists but has empty contents',
    ])
    expectAll(referenceEdit, [
      'getPreReadInstruction',
      'FILE_READ_TOOL_NAME',
      'before editing',
      'old_string',
    ])
    expect(referenceEdit).toMatch(/old_string\\?`\s+is not unique/)
    expectAll(referenceTodo, [
      'Exactly ONE task must be in_progress',
      'Never mark a task as completed',
      'Tests are failing',
    ])

    expect(DSXU_FILE_READ_DISCIPLINE).toContain('use Read for exact local file contents')
    expect(DSXU_FILE_READ_DISCIPLINE).toContain('do not use Read for directories')
    expect(FILE_UNCHANGED_STUB).toContain('advance to the next file, Edit, or verification step')
    expect(dsxuEditPrompt).toContain('You must use your `Read` tool')
    expect(dsxuEditPrompt).toContain('old_string` is not unique')
    expect(dsxuEditPrompt).toContain('Do not issue two Edit calls in one assistant turn')
    expect(TODO_WRITE_PROMPT).toContain('Exactly ONE task must be in_progress')
    expect(TODO_WRITE_PROMPT).toContain('do not mark todos complete before verification')
  })

  test('requires agent and compact behavior to preserve evidence instead of guessing', () => {
    const referenceAgent = referenceFile('tools', 'AgentTool', 'prompt.ts')
    const referenceCompact = referenceFile('services', 'compact', 'prompt.ts')
    const agentProfile = getDsxuAgentPromptRuntimeProfile()
    const compactSnapshot = buildCompactRecoverySnapshot({
      primaryRequest: 'Continue a bugfix after context recovery.',
      userInstructions: ['Use source evidence before editing.'],
      changedFiles: ['src/cart.ts'],
      pendingTasks: ['Run focused verification'],
      pendingAgents: ['verifier-agent'],
      failedCommands: ['bun test src/cart.test.ts failed'],
      permissionDenials: ['external write denied'],
      recoveryDecisions: ['resume from compact schema before editing'],
      verificationStatus: 'fail',
      nextActions: ['Read src/cart.ts', 'Run bun test src/cart.test.ts'],
    })
    const renderedCompact = renderCompactRecoverySnapshot(compactSnapshot)

    expectAll(referenceAgent, [
      'Never fabricate or predict fork results',
      'Give status, not a fabricated result',
      'Never delegate understanding',
    ])
    expectAll(referenceCompact, [
      'Primary Request and Intent',
      'Errors and fixes',
      'Pending Tasks',
      'Optional Next Step',
    ])

    expect(agentProfile.promptDiscipline).toContain('do not fabricate pending fork results')
    expect(agentProfile.promptDiscipline).toContain('do not delegate understanding')
    expect(agentProfile.visibleOrchestrationModes).toEqual(['serial worker', 'parallel fanout'])
    expect(agentProfile.executionPlacements).toContain('fork context inheritance')
    expect(renderedCompact).toContain('dsxu.compact-recovery.v1')
    expect(renderedCompact).toContain('Continue a bugfix after context recovery.')
    expect(renderedCompact).toContain('bun test src/cart.test.ts failed')
    expect(renderedCompact).toContain('external write denied')
    expect(renderedCompact).toContain('Read src/cart.ts')
  })
})
