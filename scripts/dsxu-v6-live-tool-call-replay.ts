import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { DeepSeekAdapter } from '../src/services/api/deepseek-adapter'

type ReplayCheck = {
  id: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  evidence: string[]
}

type ReplayReport = {
  schemaVersion: 'dsxu.v6.live-tool-call-replay.v1'
  generatedAt: string
  owner: 'DeepSeek Provider / Tool Protocol'
  status:
    | 'PASS_V6_LIVE_TOOL_CALL_REPLAY'
    | 'BLOCKED_V6_LIVE_TOOL_CALL_REPLAY'
    | 'SKIPPED_V6_LIVE_TOOL_CALL_REPLAY'
  mode: 'live'
  claimBoundary: string
  route: {
    model: 'deepseek-v4-flash'
    apiMode: 'thinking'
    reasoningEffort: 'low'
    toolSchemaPath: 'strict_schema'
  }
  checks: ReplayCheck[]
  blockers: string[]
  metrics: {
    requestCount: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheHitTokens: number
    totalCacheMissTokens: number
    totalEstimatedCostUsd: number
  }
  evidence: {
    toolCallId?: string
    toolName?: string
    toolArgs?: Record<string, unknown>
    toolResultPreview?: string
    fallbackXmlSchemaPath?: string
    fallbackHiddenBlocked?: boolean
  }
}

const ROOT = process.cwd()
const DATE = '20260519'
const OUT_JSON = join(ROOT, 'docs', 'generated', `DSXU_V6_LIVE_TOOL_CALL_REPLAY_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_LIVE_TOOL_CALL_REPLAY_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function pass(id: string, evidence: string[]): ReplayCheck {
  return { id, status: 'PASS', evidence }
}

function fail(id: string, evidence: string[]): ReplayCheck {
  return { id, status: 'FAIL', evidence }
}

function skip(id: string, evidence: string[]): ReplayCheck {
  return { id, status: 'SKIP', evidence }
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (!block || typeof block !== 'object') return ''
      const text = (block as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('\n')
}

function firstToolUse(response: any): {
  id: string
  name: string
  input: Record<string, unknown>
  schemaPath?: string
} | null {
  const content = Array.isArray(response?.content) ? response.content : []
  const block = content.find((item: any) => item?.type === 'tool_use')
  if (!block) return null
  return {
    id: String(block.id ?? ''),
    name: String(block.name ?? ''),
    input: block.input && typeof block.input === 'object' && !Array.isArray(block.input)
      ? block.input as Record<string, unknown>
      : {},
    schemaPath: typeof block.schemaPath === 'string' ? block.schemaPath : undefined,
  }
}

function usageOf(response: any): {
  input: number
  output: number
  cacheHit: number
  cacheMiss: number
  cost: number
} {
  const usage = response?.usage ?? {}
  return {
    input: Number(usage.input_tokens ?? 0),
    output: Number(usage.output_tokens ?? 0),
    cacheHit: Number(usage.cache_read_input_tokens ?? 0),
    cacheMiss: Number(usage.cache_creation_input_tokens ?? 0),
    cost: Number(usage.dsxu?.estimated_cost_usd ?? 0),
  }
}

function buildMetrics(responses: any[]): ReplayReport['metrics'] {
  const usages = responses.map(usageOf)
  return {
    requestCount: responses.length,
    totalInputTokens: usages.reduce((sum, usage) => sum + usage.input, 0),
    totalOutputTokens: usages.reduce((sum, usage) => sum + usage.output, 0),
    totalCacheHitTokens: usages.reduce((sum, usage) => sum + usage.cacheHit, 0),
    totalCacheMissTokens: usages.reduce((sum, usage) => sum + usage.cacheMiss, 0),
    totalEstimatedCostUsd: Number(usages.reduce((sum, usage) => sum + usage.cost, 0).toFixed(9)),
  }
}

async function callDeepSeek(params: Record<string, unknown>, apiKey: string): Promise<any> {
  return await DeepSeekAdapter.transformRequest(params, {
    apiKey,
    signal: AbortSignal.timeout(60_000),
    dsxuRouteInput: {
      workflowKind: 'ordinary_verification',
      role: 'executor',
      riskLevel: 'low',
    },
  })
}

async function runLive(): Promise<ReplayReport> {
  const checks: ReplayCheck[] = []
  const blockers: string[] = []
  const evidence: ReplayReport['evidence'] = {}
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    checks.push(skip('live-api-key', ['DEEPSEEK_API_KEY is not set; live tool-call replay was not run']))
    blockers.push('DEEPSEEK_API_KEY missing')
    return buildReport('SKIPPED_V6_LIVE_TOOL_CALL_REPLAY', checks, blockers, [], evidence)
  }
  checks.push(pass('live-api-key', ['DEEPSEEK_API_KEY=set:redacted']))

  const tool = {
    name: 'dsxu_live_echo',
    description: 'Return the supplied marker and number for DSXU live tool-call replay evidence.',
    input_schema: {
      type: 'object',
      properties: {
        marker: { type: 'string' },
        number: { type: 'number' },
      },
      required: ['marker', 'number'],
      additionalProperties: false,
    },
  }

  let first: any
  let second: any
  try {
    first = await callDeepSeek({
      model: 'deepseek-v4-flash',
      max_tokens: 160,
      stream: false,
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
      tools: [tool],
      tool_choice: { name: 'dsxu_live_echo' },
      messages: [{
        role: 'user',
        content: 'Use the dsxu_live_echo tool exactly once with marker DSXU_V6_TOOL_REPLAY_OK and number 7. Do not answer directly before the tool call.',
      }],
    }, apiKey)
  } catch (error) {
    checks.push(fail('live-strict-tool-call-request', [
      error instanceof Error ? error.message : String(error),
    ]))
    blockers.push('first live strict tool-call request failed')
    return buildReport('BLOCKED_V6_LIVE_TOOL_CALL_REPLAY', checks, blockers, [], evidence)
  }

  const toolUse = firstToolUse(first)
  if (!toolUse) {
    checks.push(fail('live-strict-tool-call-returned', [
      `stop_reason=${String(first?.stop_reason ?? 'unknown')}`,
      `text=${contentText(first?.content).slice(0, 160) || '<empty>'}`,
    ]))
    blockers.push('model did not return a strict tool call')
    return buildReport('BLOCKED_V6_LIVE_TOOL_CALL_REPLAY', checks, blockers, [first], evidence)
  }
  evidence.toolCallId = toolUse.id
  evidence.toolName = toolUse.name
  evidence.toolArgs = toolUse.input
  checks.push(
    toolUse.name === 'dsxu_live_echo' &&
      toolUse.input.marker === 'DSXU_V6_TOOL_REPLAY_OK' &&
      Number(toolUse.input.number) === 7
      ? pass('live-strict-tool-call-returned', [
          `toolName=${toolUse.name}`,
          `toolCallId=${toolUse.id}`,
          `schemaPath=${toolUse.schemaPath ?? 'strict_schema'}`,
        ])
      : fail('live-strict-tool-call-returned', [
          `toolName=${toolUse.name}`,
          `input=${JSON.stringify(toolUse.input)}`,
        ]),
  )

  const localToolResult = {
    marker: toolUse.input.marker,
    number: toolUse.input.number,
    echoedBy: 'dsxu-local-tool-simulator',
  }
  evidence.toolResultPreview = JSON.stringify(localToolResult)

  try {
    second = await callDeepSeek({
      model: 'deepseek-v4-flash',
      max_tokens: 96,
      stream: false,
      thinking: { type: 'enabled' },
      reasoning_effort: 'low',
      messages: [
        {
          role: 'user',
          content: 'Use the dsxu_live_echo tool exactly once with marker DSXU_V6_TOOL_REPLAY_OK and number 7. Do not answer directly before the tool call.',
        },
        {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
          }],
        },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(localToolResult),
          }, {
            type: 'text',
            text: 'Now reply exactly: DSXU_V6_TOOL_REPLAY_FINAL_OK',
          }],
        },
      ],
    }, apiKey)
  } catch (error) {
    checks.push(fail('live-tool-result-replay-final', [
      error instanceof Error ? error.message : String(error),
    ]))
    blockers.push('second live tool-result replay request failed')
    return buildReport('BLOCKED_V6_LIVE_TOOL_CALL_REPLAY', checks, blockers, [first], evidence)
  }

  const finalText = contentText(second?.content)
  checks.push(
    /DSXU_V6_TOOL_REPLAY_FINAL_OK/i.test(finalText)
      ? pass('live-tool-result-replay-final', ['final marker returned after tool result replay'])
      : fail('live-tool-result-replay-final', [`finalText=${finalText.slice(0, 160) || '<empty>'}`]),
  )

  const fallbackXml = DeepSeekAdapter.extractToolUsesFromTextWithEvidence(
    '<Read><path>src/index.ts</path></Read>',
    { allowedNames: ['Read'], maxCalls: 1 },
  )[0]
  evidence.fallbackXmlSchemaPath = fallbackXml?.schemaPath
  checks.push(
    fallbackXml?.schemaPath === 'xml_fallback'
      ? pass('fallback-observable-not-strict', [`schemaPath=${fallbackXml.schemaPath}`, fallbackXml.fallbackReason])
      : fail('fallback-observable-not-strict', [`fallback=${JSON.stringify(fallbackXml)}`]),
  )

  const hiddenFallback = DeepSeekAdapter.extractToolUsesFromTextWithEvidence(
    '<MCPDocs>{"query":"hidden"}</MCPDocs>',
    { allowedNames: ['Read', 'Edit', 'Bash'], maxCalls: 1 },
  )
  evidence.fallbackHiddenBlocked = hiddenFallback.length === 0
  checks.push(
    hiddenFallback.length === 0
      ? pass('fallback-hidden-tool-blocked', ['MCPDocs fallback produced no allowed tool calls'])
      : fail('fallback-hidden-tool-blocked', [`hiddenFallback=${JSON.stringify(hiddenFallback)}`]),
  )

  const failed = checks.filter(check => check.status === 'FAIL')
  blockers.push(...failed.map(check => check.id))
  return buildReport(
    blockers.length === 0 ? 'PASS_V6_LIVE_TOOL_CALL_REPLAY' : 'BLOCKED_V6_LIVE_TOOL_CALL_REPLAY',
    checks,
    blockers,
    [first, second],
    evidence,
  )
}

function buildReport(
  status: ReplayReport['status'],
  checks: ReplayCheck[],
  blockers: string[],
  responses: any[],
  evidence: ReplayReport['evidence'],
): ReplayReport {
  return {
    schemaVersion: 'dsxu.v6.live-tool-call-replay.v1',
    generatedAt: new Date().toISOString(),
    owner: 'DeepSeek Provider / Tool Protocol',
    status,
    mode: 'live',
    claimBoundary: 'This proves one live DeepSeek Flash strict tool-call round trip plus local tool-result replay and fallback blocking evidence. It is not an external benchmark or public 90% model-quality claim.',
    route: {
      model: 'deepseek-v4-flash',
      apiMode: 'thinking',
      reasoningEffort: 'low',
      toolSchemaPath: 'strict_schema',
    },
    checks,
    blockers,
    metrics: buildMetrics(responses),
    evidence,
  }
}

function renderMarkdown(report: ReplayReport): string {
  return [
    '# DSXU V6 Live Tool-Call Replay',
    '',
    `- status: \`${report.status}\``,
    `- mode: \`${report.mode}\``,
    `- owner: \`${report.owner}\``,
    `- claimBoundary: ${report.claimBoundary}`,
    '',
    '## Metrics',
    '',
    '| metric | value |',
    '|---|---:|',
    `| requestCount | ${report.metrics.requestCount} |`,
    `| totalInputTokens | ${report.metrics.totalInputTokens} |`,
    `| totalOutputTokens | ${report.metrics.totalOutputTokens} |`,
    `| totalCacheHitTokens | ${report.metrics.totalCacheHitTokens} |`,
    `| totalCacheMissTokens | ${report.metrics.totalCacheMissTokens} |`,
    `| totalEstimatedCostUsd | ${report.metrics.totalEstimatedCostUsd} |`,
    '',
    '## Checks',
    '',
    '| id | status | evidence |',
    '|---|---|---|',
    ...report.checks.map(check => `| ${check.id} | ${check.status} | ${check.evidence.join('<br>')} |`),
    '',
    '## Blockers',
    '',
    report.blockers.length === 0 ? '- none' : report.blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(join(ROOT, 'docs', 'generated'), { recursive: true })
  const report = await runLive()
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    blockers: report.blockers,
    metrics: report.metrics,
    outputs: {
      json: rel(OUT_JSON),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
  if (report.status === 'BLOCKED_V6_LIVE_TOOL_CALL_REPLAY') process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
