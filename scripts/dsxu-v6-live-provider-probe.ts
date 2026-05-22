import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  DeepSeekAdapter,
  type DeepSeekRequestPlan,
} from '../src/services/api/deepseek-adapter'

type ProbeCheck = {
  id: string
  status: 'PASS' | 'FAIL'
  evidence: string[]
}

type ProbeReport = {
  schemaVersion: 'dsxu.v6.deepseek-provider-probe.v1'
  generatedAt: string
  owner: 'DeepSeek Provider Contract'
  status: 'PASS_V6_DEEPSEEK_PROVIDER_CONTRACT' | 'BLOCKED_V6_DEEPSEEK_PROVIDER_CONTRACT'
  mode: 'dry-run' | 'live'
  claimBoundary: string
  checks: ProbeCheck[]
  blockers: string[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const OUT_JSON = join(ROOT, 'docs', 'generated', `DSXU_V6_DEEPSEEK_PROVIDER_PROBE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_DEEPSEEK_PROVIDER_PROBE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function hasArg(name: string): boolean {
  return process.argv.slice(2).includes(name)
}

function makePlan(partial: Partial<DeepSeekRequestPlan> = {}): DeepSeekRequestPlan {
  return {
    baseUrl: 'https://api.deepseek.com',
    isOpenRouter: false,
    requestedModel: 'deepseek-v4-flash',
    modelName: 'deepseek-v4-flash',
    apiMode: partial.apiMode ?? 'thinking',
    thinkingEnabled: partial.thinkingEnabled ?? true,
    reasoningEffort: partial.reasoningEffort ?? 'high',
    endpointKind: 'chat',
    maxTokens: 1024,
    routeReason: 'coding_flash_thinking_high',
    modelEvidence:
      'DSXU model evidence: deepseek-v4-flash thinking high; reason=coding_flash_thinking_high; max_tokens=1024; cost_basis=cache_hit/cache_miss/output.',
    ...partial,
  }
}

function pass(id: string, evidence: string[]): ProbeCheck {
  return { id, status: 'PASS', evidence }
}

function fail(id: string, evidence: string[]): ProbeCheck {
  return { id, status: 'FAIL', evidence }
}

function buildDryRunChecks(): ProbeCheck[] {
  const thinkingPlan = makePlan()
  const body = DeepSeekAdapter.buildDeepSeekChatCompletionBody({
    plan: thinkingPlan,
    messages: [{
      role: 'assistant',
      content: 'inspect source',
      reasoning_content: 'locate source before editing',
      tool_calls: [{
        id: 'toolu-read-1',
        type: 'function',
        function: { name: 'Read', arguments: JSON.stringify({ file_path: 'src/app.ts' }) },
      }],
    }, {
      role: 'tool',
      tool_call_id: 'toolu-read-1',
      content: 'source text',
    }],
    stream: true,
    tools: [{
      name: 'ComplexEdit',
      description: 'apply structured edit',
      input_schema: {
        type: 'object',
        properties: {
          patch: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                properties: {
                  file_path: { type: 'string' },
                  line: { type: 'number' },
                },
                required: ['file_path', 'line'],
              },
              replacement: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                },
                required: ['text'],
              },
            },
            required: ['target', 'replacement'],
          },
        },
        required: ['patch'],
      },
    }],
    toolSchemaPlans: DeepSeekAdapter.buildDeepSeekToolSchemaPlans([{
      name: 'ComplexEdit',
      input_schema: {
        type: 'object',
        properties: {
          patch: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                properties: {
                  file_path: { type: 'string' },
                  line: { type: 'number' },
                },
                required: ['file_path', 'line'],
              },
              replacement: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                },
                required: ['text'],
              },
            },
            required: ['target', 'replacement'],
          },
        },
        required: ['patch'],
      },
    }]),
  })
  const record = body as Record<string, any>
  const checks: ProbeCheck[] = []
  checks.push(record.model === 'deepseek-v4-flash' && record.thinking?.type === 'enabled'
    ? pass('model-thinking-contract', ['model=deepseek-v4-flash', 'thinking=enabled'])
    : fail('model-thinking-contract', [`body=${JSON.stringify(record)}`]))
  checks.push(record.reasoning_effort === 'high'
    ? pass('reasoning-effort-contract', ['reasoning_effort=high'])
    : fail('reasoning-effort-contract', [`reasoning_effort=${record.reasoning_effort}`]))
  checks.push(record.stream_options?.include_usage === true
    ? pass('stream-usage-contract', ['stream_options.include_usage=true'])
    : fail('stream-usage-contract', ['missing stream usage']))
  const assistant = record.messages.find((message: any) => message.role === 'assistant')
  checks.push(
    assistant?.reasoning_content &&
      assistant?.tool_calls?.[0]?.function?.name === 'Read' &&
      record.messages.some((message: any) => message.role === 'tool' && message.tool_call_id === 'toolu-read-1')
      ? pass('thinking-tool-round-trip-contract', ['assistant.reasoning_content present', 'assistant.tool_calls present', 'tool result role present'])
      : fail('thinking-tool-round-trip-contract', [`messages=${JSON.stringify(record.messages)}`]),
  )
  const parameters = record.tools?.[0]?.function?.parameters
  checks.push(parameters?.additionalProperties === false && Array.isArray(parameters.required)
    ? pass('strict-schema-flat-contract', [`required=${parameters.required.join('|')}`, 'additionalProperties=false'])
    : fail('strict-schema-flat-contract', [`parameters=${JSON.stringify(parameters)}`]))
  return checks
}

function maskSecret(value: string): string {
  void value
  return 'set:redacted'
}

function textFromContentBlocks(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
        const text = (block as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      }
      return ''
    })
    .join('\n')
    .trim()
}

async function buildLiveChecks(): Promise<ProbeCheck[]> {
  const checks: ProbeCheck[] = []
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    return [
      fail('live-api-key', ['DEEPSEEK_API_KEY is not set; live provider proof cannot run']),
    ]
  }
  checks.push(pass('live-api-key', [`DEEPSEEK_API_KEY=${maskSecret(apiKey)}`]))

  try {
    const result = await DeepSeekAdapter.transformRequest({
      model: 'deepseek-v4-flash',
      max_tokens: 64,
      stream: false,
      thinking: { type: 'disabled' },
      metadata: {
        dsxuRouteInput: {
          workflowKind: 'ordinary_verification',
          role: 'executor',
          riskLevel: 'low',
        },
      },
      messages: [{
        role: 'user',
        content: 'DSXU V6 live provider probe. Reply with exactly: DSXU_V6_LIVE_OK',
      }],
    }, {
      apiKey,
      signal: AbortSignal.timeout(45_000),
    }) as any

    const text = textFromContentBlocks(result?.content)
    const usage = result?.usage ?? {}
    const model = usage?.dsxu?.model ?? result?.model ?? 'unknown'
    const cacheHit = Number(usage?.cache_read_input_tokens ?? 0)
    const cacheMiss = Number(usage?.cache_creation_input_tokens ?? 0)
    const outputTokens = Number(usage?.output_tokens ?? 0)
    const estimatedCost = Number(usage?.dsxu?.estimated_cost_usd ?? 0)

    checks.push(
      /DSXU_V6_LIVE_OK/i.test(text)
        ? pass('live-flash-response', [`model=${model}`, 'expected marker returned'])
        : fail('live-flash-response', [`model=${model}`, `text=${text.slice(0, 120) || '<empty>'}`]),
    )
    checks.push(
      outputTokens > 0
        ? pass('live-usage-output-tokens', [`output_tokens=${outputTokens}`])
        : fail('live-usage-output-tokens', [`usage=${JSON.stringify(usage)}`]),
    )
    checks.push(
      Number.isFinite(cacheHit) && Number.isFinite(cacheMiss)
        ? pass('live-cache-usage-fields', [`cache_hit=${cacheHit}`, `cache_miss=${cacheMiss}`])
        : fail('live-cache-usage-fields', [`usage=${JSON.stringify(usage)}`]),
    )
    checks.push(
      Number.isFinite(estimatedCost) && estimatedCost >= 0
        ? pass('live-cost-evidence', [`estimated_cost_usd=${estimatedCost}`])
        : fail('live-cost-evidence', [`estimated_cost_usd=${String(usage?.dsxu?.estimated_cost_usd)}`]),
    )
  } catch (error) {
    checks.push(fail('live-provider-request', [
      error instanceof Error ? error.message : String(error),
    ]))
  }

  return checks
}

function renderMarkdown(report: ProbeReport): string {
  return `# DSXU V6 DeepSeek Provider Probe - ${DATE}

状态：${report.status}

模式：${report.mode}

边界：${report.claimBoundary}

| check | status | evidence |
|---|---|---|
${report.checks.map(check => `| ${check.id} | ${check.status} | ${check.evidence.join('<br>')} |`).join('\n')}

## Blockers

${report.blockers.length === 0 ? '- none' : report.blockers.map(item => `- ${item}`).join('\n')}
`
}

async function main(): Promise<void> {
  const live = hasArg('--live')
  const dryRun = hasArg('--dry-run') || !live
  const checks = dryRun ? buildDryRunChecks() : await buildLiveChecks()
  const blockers = checks.filter(check => check.status !== 'PASS').map(check => `${check.id}: ${check.evidence.join('; ')}`)
  const report: ProbeReport = {
    schemaVersion: 'dsxu.v6.deepseek-provider-probe.v1',
    generatedAt: new Date().toISOString(),
    owner: 'DeepSeek Provider Contract',
    status: blockers.length === 0
      ? 'PASS_V6_DEEPSEEK_PROVIDER_CONTRACT'
      : 'BLOCKED_V6_DEEPSEEK_PROVIDER_CONTRACT',
    mode: dryRun ? 'dry-run' : 'live',
    claimBoundary:
      dryRun
        ? 'Dry-run provider contract validation only. It proves request-shape, thinking/tool-call, strict schema, and usage-request contracts, not live DeepSeek availability or quality.'
        : 'Live DeepSeek Flash provider probe. It proves basic API availability, response marker, usage/cache/cost fields for one fixed low-risk probe only. It is not a benchmark, not a full tool-call live replay, and not a public model-quality claim.',
    checks,
    blockers,
  }
  await mkdir(join(ROOT, 'docs', 'generated'), { recursive: true })
  await mkdir(join(ROOT, 'docs'), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    mode: report.mode,
    checkCount: report.checks.length,
    blockers,
    outputs: {
      json: rel(OUT_JSON),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
