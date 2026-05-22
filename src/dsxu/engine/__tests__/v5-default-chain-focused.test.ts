import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  ToolRegistry,
  queryLoop,
} from '..'
import type { LLMResponse, QueryEvent, ToolDefinition } from '../types'
import {
  buildPostMutationSemanticCodeGraphEvidence,
  buildPostMutationVerificationEnvelope,
  summarizePostMutationVerificationEnvelope,
} from '../post-mutation-verification-envelope'

async function collectEvents(gen: AsyncGenerator<QueryEvent, unknown>): Promise<{ events: QueryEvent[]; result: any }> {
  const events: QueryEvent[] = []
  let current = await gen.next()
  while (!current.done) {
    events.push(current.value)
    current = await gen.next()
  }
  return { events, result: current.value }
}

function response(content: string, toolCalls: LLMResponse['toolCalls'] = []): LLMResponse {
  return {
    content,
    toolCalls,
    stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    usage: {
      inputTokens: 400,
      outputTokens: 80,
      cacheHit: true,
      cacheReadTokens: 300,
      cacheCreationTokens: 20,
    },
  }
}

describe('V5 default-chain focused acceptance', () => {
  test('projects contract, tool view, active frame, semantic graph, edit proof, and verification in one owner-folded chain', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-v5-default-chain-'))
    try {
      const src = join(root, 'src')
      mkdirSync(src, { recursive: true })
      const sourceFile = join(src, 'math.ts')
      const testFile = join(src, 'math.test.ts')
      writeFileSync(sourceFile, 'export const add = (a: number, b: number) => a + b\n')
      writeFileSync(testFile, "import { add } from './math'\nconsole.log(add(1, 2))\n")

      const semantic = buildPostMutationSemanticCodeGraphEvidence({
        repoRoot: root,
        filePath: sourceFile,
      })
      const envelope = buildPostMutationVerificationEnvelope({
        filePath: sourceFile,
        changeType: 'edit',
        oldContent: 'export const add = (a: number, b: number) => a + b\n',
        newContent: 'export const add = (a: number, b: number) => Number(a) + Number(b)\n',
        semanticCodeGraph: semantic.semanticCodeGraph,
        semanticCodeGraphError: semantic.semanticCodeGraphError,
        gates: [
          { name: 'static-analysis', status: 'PASS', blocking: true, passed: true },
          { name: 'post-mutation-verification', status: 'PASS', blocking: true, passed: true },
        ],
      })
      const postMutationVerification = summarizePostMutationVerificationEnvelope(envelope)

      const editTool: ToolDefinition = {
        name: 'Edit',
        description: 'Apply a focused file edit',
        inputSchema: {
          type: 'object',
          properties: { file_path: { type: 'string' } },
          required: ['file_path'],
        },
        execute: async (_input, context) => ({
          content: `edited ${context.cwd}\n${postMutationVerification.compactLine}`,
          isError: false,
          meta: { postMutationVerification },
        }),
        readOnly: false,
        concurrencySafe: false,
      }
      const bashTool: ToolDefinition = {
        name: 'Bash',
        description: 'Run verification',
        inputSchema: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
        execute: async () => ({
          content: '1 pass\n0 fail',
          isError: false,
        }),
        readOnly: true,
        concurrencySafe: true,
      }
      const registry = new ToolRegistry()
      registry.register(editTool)
      registry.register(bashTool)
      registry.register({
        name: 'Read',
        description: 'Read source truth',
        inputSchema: { type: 'object', properties: { file_path: { type: 'string' } } },
        execute: async () => ({ content: 'source truth', isError: false }),
        readOnly: true,
        concurrencySafe: true,
      })

      let seenTools: string[] = []
      const gen = queryLoop(
        {
          cwd: root,
          maxTurns: 2,
          llmCall: async (_messages, tools) => {
            seenTools = tools.map(tool => tool.name)
            if (!seenTools.includes('Edit')) return response('missing edit tool')
            return response('editing', [
              {
                id: 'tool-v5-edit',
                name: 'Edit',
                arguments: { file_path: sourceFile },
              },
            ])
          },
          toolSubset: { enabled: true, maxTools: 12, minTools: 2 },
        },
        [{ role: 'user', content: 'Fix math add and verify affected tests' }],
        registry,
        { sessionId: 'v5-default-chain', requestId: 'v5-focused-chain' },
      )
      const { events, result } = await collectEvents(gen)

      const subset = events.find(event => event.type === 'tool_subset_selected') as any
      const started = events.find(event => event.type === 'loop_started') as any
      const toolResult = events.find(event => event.type === 'tool_result') as any

      expect(subset?.withinVisibleToolHardCap).toBe(true)
      expect(subset?.v5ToolViewVisibleToolCount ?? subset?.selectedTools).toBeLessThanOrEqual(12)
      expect(started?.metadata?.activeFrame?.schemaVersion).toBe('dsxu.active-frame.v5')
      expect(toolResult?.metadata?.activeFrame?.schemaVersion).toBe('dsxu.active-frame.v5')
      expect(result.metadata.progressLedger.events.some((event: any) => event.kind === 'task_contract')).toBe(true)
      expect(result.metadata.activeFrame.schemaVersion).toBe('dsxu.active-frame.v5')
      expect(envelope.semanticCodeGraph?.affectedTests).toContain(testFile)
      expect(envelope.editProof.claimAllowed).toBe(true)
      expect(postMutationVerification.semanticCodeGraph?.affectedTestCount).toBe(1)
      expect(seenTools.length).toBeLessThanOrEqual(12)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
