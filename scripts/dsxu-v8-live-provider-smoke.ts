import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DeepSeekAdapter } from '../src/services/api/deepseek-adapter'

type Check = {
  id: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  evidence: string[]
}

function hasArg(name: string): boolean {
  return process.argv.includes(name)
}

function pass(id: string, evidence: string[]): Check {
  return { id, status: 'PASS', evidence }
}

function fail(id: string, evidence: string[]): Check {
  return { id, status: 'FAIL', evidence }
}

function skip(id: string, evidence: string[]): Check {
  return { id, status: 'SKIP', evidence }
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function dryRunChecks(): Check[] {
  const toolSchemaPlans = DeepSeekAdapter.buildDeepSeekToolSchemaPlans([{
    name: 'Read',
    description: 'read a bounded source file range',
    input_schema: {
      type: 'object',
      properties: {
        source: {
          type: 'object',
          properties: {
            target: {
              type: 'object',
              properties: {
                file_path: { type: 'string' },
                offset: { type: 'number' },
                limit: { type: 'number' },
              },
              required: ['file_path'],
            },
            safety: {
              type: 'object',
              properties: {
                bounded: { type: 'boolean' },
                reason: { type: 'string' },
              },
              required: ['bounded'],
            },
          },
          required: ['target', 'safety'],
        },
      },
      required: ['source'],
    },
  }])
  const body = DeepSeekAdapter.buildDeepSeekChatCompletionBody({
    plan: {
      baseUrl: 'https://api.deepseek.com',
      isOpenRouter: false,
      requestedModel: 'deepseek-v4-flash',
      modelName: 'deepseek-v4-flash',
      apiMode: 'thinking',
      thinkingEnabled: true,
      reasoningEffort: 'low',
      endpointKind: 'chat',
      maxTokens: 128,
      routeReason: 'repo_understanding_flash_thinking_low',
      modelEvidence: 'V8 provider smoke dry-run contract',
    },
    stream: true,
    messages: [
      {
        role: 'assistant',
        content: 'Need bounded source truth before answering.',
        reasoning_content: 'Use a source read, then summarize.',
        tool_calls: [{
          id: 'call-read-v8',
          type: 'function',
          function: { name: 'Read', arguments: JSON.stringify({ file_path: 'README.md', limit: 40 }) },
        }],
      },
      {
        role: 'tool',
        tool_call_id: 'call-read-v8',
        content: 'README excerpt',
      },
    ],
    tools: [{
      name: 'Read',
      description: 'read a bounded source file range',
      input_schema: {
        type: 'object',
        properties: {
          source: {
            type: 'object',
            properties: {
              target: {
                type: 'object',
                properties: {
                  file_path: { type: 'string' },
                  offset: { type: 'number' },
                  limit: { type: 'number' },
                },
                required: ['file_path'],
              },
              safety: {
                type: 'object',
                properties: {
                  bounded: { type: 'boolean' },
                  reason: { type: 'string' },
                },
                required: ['bounded'],
              },
            },
            required: ['target', 'safety'],
          },
        },
        required: ['source'],
      },
    }],
    toolSchemaPlans,
  }) as Record<string, any>
  const assistant = body.messages.find((message: any) => message.role === 'assistant')
  const tool = body.messages.find((message: any) => message.role === 'tool')
  return [
    body.model === 'deepseek-v4-flash' ? pass('model', ['model=deepseek-v4-flash']) : fail('model', [`model=${body.model}`]),
    body.thinking?.type === 'enabled' ? pass('thinking', ['thinking=enabled']) : fail('thinking', [`thinking=${JSON.stringify(body.thinking)}`]),
    assistant?.reasoning_content ? pass('reasoning-content', ['assistant.reasoning_content present']) : fail('reasoning-content', ['missing reasoning_content']),
    assistant?.tool_calls?.[0]?.function?.name === 'Read' && tool?.tool_call_id === 'call-read-v8'
      ? pass('tool-round-trip', ['assistant.tool_calls and tool result are projected'])
      : fail('tool-round-trip', [`messages=${JSON.stringify(body.messages)}`]),
    body.stream_options?.include_usage === true ? pass('usage-stream', ['include_usage=true']) : fail('usage-stream', ['missing stream usage']),
    body.tools?.[0]?.function?.parameters?.additionalProperties === false
      ? pass('strict-tool-schema', ['additionalProperties=false'])
      : fail('strict-tool-schema', [`tools=${JSON.stringify(body.tools)}`]),
  ]
}

function textFromContent(content: unknown): string {
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

async function liveChecks(): Promise<Check[]> {
  const key = process.env.DEEPSEEK_API_KEY?.trim() || process.env.DSXU_API_KEY?.trim()
  if (!key) return [skip('live-key', ['no DeepSeek key in environment; dry-run contract remains the authority for this smoke'])]
  try {
    const response = await DeepSeekAdapter.transformRequest({
      model: 'deepseek-v4-flash',
      max_tokens: 48,
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
        content: 'DSXU V8 provider smoke. Reply exactly: DSXU_V8_LIVE_OK',
      }],
    }, {
      apiKey: key,
      signal: AbortSignal.timeout(45_000),
    }) as any
    const text = textFromContent(response?.content)
    const usage = response?.usage ?? {}
    return [
      /DSXU_V8_LIVE_OK/i.test(text)
        ? pass('live-response-marker', ['marker=DSXU_V8_LIVE_OK'])
        : fail('live-response-marker', [`text=${text.slice(0, 100) || '<empty>'}`]),
      Number(usage?.output_tokens ?? 0) > 0
        ? pass('live-usage', [`output_tokens=${Number(usage.output_tokens)}`])
        : fail('live-usage', [`usage=${JSON.stringify(usage)}`]),
      Number.isFinite(Number(usage?.dsxu?.estimated_cost_usd ?? 0))
        ? pass('live-cost-field', [`estimated_cost_usd=${Number(usage?.dsxu?.estimated_cost_usd ?? 0)}`])
        : fail('live-cost-field', [`usage=${JSON.stringify(usage)}`]),
    ]
  } catch (error) {
    return [fail('live-provider-request', [error instanceof Error ? error.message : String(error)])]
  }
}

async function main(): Promise<void> {
  const live = hasArg('--live')
  const checks = live ? [...dryRunChecks(), ...(await liveChecks())] : dryRunChecks()
  const blockers = checks
    .filter(check => check.status === 'FAIL')
    .map(check => `${check.id}:${check.evidence.join('; ')}`)
  const report = {
    schemaVersion: 'dsxu.v8.live-provider-smoke.v1',
    generatedAt: new Date().toISOString(),
    owner: 'DeepSeek Provider Contract',
    mode: live ? 'live' : 'dry-run',
    status: blockers.length === 0 ? 'PASS_V8_PROVIDER_SMOKE_CONTRACT' : 'FAIL_V8_PROVIDER_SMOKE_CONTRACT',
    publicClaimAllowed: false,
    checks,
    blockers,
    rule:
      'This smoke validates DeepSeek API contract shape and optional one-call Flash availability only. It is not a benchmark, not a model-quality claim, and not a public 90/95 claim.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_LIVE_PROVIDER_SMOKE_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V8_LIVE_PROVIDER_SMOKE_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V8 Live Provider Smoke',
    '',
    `Status: ${report.status}`,
    '',
    `Mode: ${report.mode}`,
    '',
    '| check | status | evidence |',
    '|---|---|---|',
    ...checks.map(check => `| ${check.id} | ${check.status} | ${check.evidence.join('<br>')} |`),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    mode: report.mode,
    checkCount: checks.length,
    blockers,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

await main()
