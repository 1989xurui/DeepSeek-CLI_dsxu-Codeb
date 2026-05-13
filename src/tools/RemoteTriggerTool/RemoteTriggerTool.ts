import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod/v4'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import type { ToolUseContext } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getDsxuConfigHomeDir, isEnvTruthy } from '../../utils/envUtils.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { callLegacyRemoteTriggerProvider } from './legacyRemoteTriggerProvider.js'
import { DESCRIPTION, PROMPT, REMOTE_TRIGGER_TOOL_NAME } from './prompt.js'
import { renderToolResultMessage, renderToolUseMessage } from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['list', 'get', 'create', 'update', 'run']),
    trigger_id: z
      .string()
      .regex(/^[\w-]+$/)
      .optional()
      .describe('Required for get, update, and run'),
    body: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('JSON body for create and update'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>
export type Input = z.infer<InputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    status: z.number(),
    json: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

type DsxuRemoteTriggerRecord = {
  id: string
  name: string
  enabled: boolean
  cron_expression?: string
  body: Record<string, unknown>
  created_at: string
  updated_at: string
  last_run_at?: string
  provider: 'DSXU Remote Session Provider'
}

function isDsxuRemoteTriggerProvider(): boolean {
  return isEnvTruthy(process.env.DSXU_CODE_MODE)
}

function isLegacyDSXURemoteTriggerMigrationEnabled(): boolean {
  return isEnvTruthy(process.env.DSXU_ENABLE_LEGACY_DSXU_REMOTE_TRIGGER)
}

function getDsxuRemoteTriggerStorePath(): string {
  return join(getDsxuConfigHomeDir(), 'remote-triggers.json')
}

async function readDsxuRemoteTriggers(): Promise<DsxuRemoteTriggerRecord[]> {
  try {
    const raw = await readFile(getDsxuRemoteTriggerStorePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDsxuRemoteTriggers(
  triggers: DsxuRemoteTriggerRecord[],
): Promise<void> {
  const path = getDsxuRemoteTriggerStorePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${jsonStringify(triggers, null, 2)}\n`, 'utf8')
}

async function callDsxuRemoteTriggerProvider(input: Input): Promise<Output> {
  const now = new Date().toISOString()
  const triggers = await readDsxuRemoteTriggers()

  switch (input.action) {
    case 'list':
      return {
        status: 200,
        json: jsonStringify({
          provider: 'DSXU Remote Session Provider',
          triggers,
        }),
      }
    case 'get': {
      if (!input.trigger_id) throw new Error('get requires trigger_id')
      const trigger = triggers.find(t => t.id === input.trigger_id)
      return {
        status: trigger ? 200 : 404,
        json: jsonStringify({
          provider: 'DSXU Remote Session Provider',
          trigger: trigger ?? null,
        }),
      }
    }
    case 'create': {
      if (!input.body) throw new Error('create requires body')
      const body = input.body
      const record: DsxuRemoteTriggerRecord = {
        id: `dsxu_trg_${randomUUID()}`,
        name: String(body.name ?? 'DSXU scheduled agent'),
        enabled: body.enabled !== false,
        cron_expression:
          typeof body.cron_expression === 'string'
            ? body.cron_expression
            : undefined,
        body,
        created_at: now,
        updated_at: now,
        provider: 'DSXU Remote Session Provider',
      }
      triggers.push(record)
      await writeDsxuRemoteTriggers(triggers)
      return {
        status: 201,
        json: jsonStringify({
          provider: 'DSXU Remote Session Provider',
          trigger: record,
        }),
      }
    }
    case 'update': {
      if (!input.trigger_id) throw new Error('update requires trigger_id')
      if (!input.body) throw new Error('update requires body')
      const index = triggers.findIndex(t => t.id === input.trigger_id)
      if (index === -1) {
        return {
          status: 404,
          json: jsonStringify({
            provider: 'DSXU Remote Session Provider',
            error: 'trigger not found',
          }),
        }
      }
      const current = triggers[index]!
      const body = { ...current.body, ...input.body }
      triggers[index] = {
        ...current,
        name: String(body.name ?? current.name),
        enabled: body.enabled !== false,
        cron_expression:
          typeof body.cron_expression === 'string'
            ? body.cron_expression
            : current.cron_expression,
        body,
        updated_at: now,
      }
      await writeDsxuRemoteTriggers(triggers)
      return {
        status: 200,
        json: jsonStringify({
          provider: 'DSXU Remote Session Provider',
          trigger: triggers[index],
        }),
      }
    }
    case 'run': {
      if (!input.trigger_id) throw new Error('run requires trigger_id')
      const index = triggers.findIndex(t => t.id === input.trigger_id)
      if (index === -1) {
        return {
          status: 404,
          json: jsonStringify({
            provider: 'DSXU Remote Session Provider',
            error: 'trigger not found',
          }),
        }
      }
      triggers[index] = {
        ...triggers[index]!,
        last_run_at: now,
        updated_at: now,
      }
      await writeDsxuRemoteTriggers(triggers)
      return {
        status: 202,
        json: jsonStringify({
          provider: 'DSXU Remote Session Provider',
          run: {
            trigger_id: input.trigger_id,
            status: 'queued',
            queued_at: now,
          },
        }),
      }
    }
  }
}

export const RemoteTriggerTool = buildTool({
  name: REMOTE_TRIGGER_TOOL_NAME,
  searchHint: 'manage scheduled remote agent triggers',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    if (!isPolicyAllowed('allow_remote_sessions')) return false
    if (isDsxuRemoteTriggerProvider()) return true
    return (
      isLegacyDSXURemoteTriggerMigrationEnabled() &&
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false)
    )
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly(input: Input) {
    return input.action === 'list' || input.action === 'get'
  },
  toAutoClassifierInput(input: Input) {
    return `RemoteTrigger ${input.action}${input.trigger_id ? ` ${input.trigger_id}` : ''}`
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  async call(input: Input, context: ToolUseContext) {
    if (isDsxuRemoteTriggerProvider()) {
      return {
        data: await callDsxuRemoteTriggerProvider(input),
      }
    }

    if (!isLegacyDSXURemoteTriggerMigrationEnabled()) {
      throw new Error(
        'Legacy remote trigger provider is physically isolated. Enable DSXU_ENABLE_LEGACY_DSXU_REMOTE_TRIGGER=1 only for one-time migration.',
      )
    }

    return {
        data: await callLegacyRemoteTriggerProvider(input, context),
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `HTTP ${output.status}\n${output.json}`,
    }
  },
  renderToolUseMessage,
  renderToolResultMessage,
} satisfies ToolDef<InputSchema, Output>)

export function getDsxuRemoteTriggerRuntimeProfile(): {
  tool: 'RemoteTrigger'
  runtime: 'DSXU Remote Session Provider'
  storePath: string
  activationEvidence: readonly string[]
  legacyIsolation: readonly string[]
} {
  return {
    tool: REMOTE_TRIGGER_TOOL_NAME,
    runtime: 'DSXU Remote Session Provider',
    storePath: getDsxuRemoteTriggerStorePath(),
    activationEvidence: [
      'DSXU_CODE_MODE enables the local DSXU remote trigger provider',
      'create/update/run persist to DSXU config remote-triggers.json',
      'legacy DSXU remote trigger provider requires explicit migration flag',
    ],
    legacyIsolation: [
      'DSXU_ENABLE_LEGACY_DSXU_REMOTE_TRIGGER gates DSXU remote trigger calls',
      'without DSXU mode or migration flag, legacy provider throws before use',
    ],
  }
}


// V14 lifecycle shim: remotetriggertool
export function processRemotetriggertoolLifecycle(input) {
  void input
  const state = 'remotetriggertool-state'
  const lifecycle = 'remotetriggertool:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
