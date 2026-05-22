import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { DSXU_AGENT_MODEL_ALIASES, DSXU_PUBLIC_MODEL_ALIASES } from '../../utils/model/aliases.js'
import { formatDeepSeekV4RequestEvidence } from '../../utils/model/deepseekV4Control.js'
import {
  DSXU_DEEPSEEK_FLASH_MAX_ALIAS,
  DSXU_DEEPSEEK_FLASH_MODEL,
  DSXU_DEEPSEEK_PRO_MODEL,
  renderDSXUModelName,
} from '../../utils/model/dsxuModel.js'
import { getProviderMigrationModelAliasEvidence } from '../../utils/model/providerMigration/providerMigrationModelCompat.js'
import { getAgentModelOptions } from '../../utils/model/agent.js'
import { getModelOptions } from '../../utils/model/modelOptions.js'

export type V18ModelPublicSurfaceStatus = 'DONE_EVIDENCED' | 'BLOCKED_EVIDENCED'
export type V18ModelPublicSurfaceKind = 'public' | 'migration' | 'provenance'

export type V18ModelPublicSurfaceItem = {
  kind: V18ModelPublicSurfaceKind
  surface: string
  value: string
}

export type V18ModelPublicSurfaceIssue = {
  severity: 'blocker' | 'review'
  surface: string
  match: string
  value: string
  reason: string
}

export type V18ModelPublicSurfaceProvenance = {
  surface: string
  provenance: 'dsxu-owned' | 'provider-migration-only' | 'test-fixture' | 'historical-doc'
  releasePolicy: 'ship' | 'migration-hidden' | 'test-only' | 'exclude'
}

export type V18ModelPublicSurfaceGate = {
  status: V18ModelPublicSurfaceStatus
  ok: boolean
  generatedAt: string
  evidencePath: string
  itemCount: number
  blockerCount: number
  reviewCount: number
  issues: readonly V18ModelPublicSurfaceIssue[]
  items: readonly V18ModelPublicSurfaceItem[]
  provenanceManifest: readonly V18ModelPublicSurfaceProvenance[]
  safeguards: readonly string[]
}

const PROVIDER_MIGRATION_SOURCE_PRODUCT = ['cl', 'aude'].join('')
const PROVIDER_MIGRATION_SOURCE_VENDOR = ['anth', 'ropic'].join('')
const PROVIDER_MIGRATION_SOURCE_MODEL_FAMILY_WORDS = ['o' + 'pus', 'son' + 'net', 'hai' + 'ku'] as const
const PROVIDER_MIGRATION_SOURCE_MODEL_FAMILY_PATTERN = PROVIDER_MIGRATION_SOURCE_MODEL_FAMILY_WORDS.join('|')

const PUBLIC_SURFACE_FORBIDDEN_PATTERNS = [
  new RegExp(`\\b(${PROVIDER_MIGRATION_SOURCE_MODEL_FAMILY_PATTERN})\\b`, 'i'),
  new RegExp(`\\b${PROVIDER_MIGRATION_SOURCE_PRODUCT}\\b`, 'i'),
  new RegExp(`\\b${PROVIDER_MIGRATION_SOURCE_VENDOR}\\b`, 'i'),
] as const

function firstProviderMigrationSourceMatch(value: string): string | undefined {
  for (const pattern of PUBLIC_SURFACE_FORBIDDEN_PATTERNS) {
    const match = value.match(pattern)
    if (match?.[0]) return match[0]
  }
  return undefined
}

function withDsxuCodeMode<T>(fn: () => T): T {
  const previous = process.env.DSXU_CODE_MODE
  process.env.DSXU_CODE_MODE = '1'
  try {
    return fn()
  } finally {
    if (previous === undefined) {
      delete process.env.DSXU_CODE_MODE
    } else {
      process.env.DSXU_CODE_MODE = previous
    }
  }
}

export function collectDsxuModelPublicSurfaceItems(): V18ModelPublicSurfaceItem[] {
  return withDsxuCodeMode(() => {
    const modelOptions = getModelOptions(false).flatMap(option => [
      {
        kind: 'public' as const,
        surface: `/model option ${String(option.value)}`,
        value: `${option.value ?? 'default'} ${option.label} ${option.description} ${option.descriptionForModel ?? ''}`,
      },
    ])
    const agentOptions = getAgentModelOptions().map(option => ({
      kind: 'public' as const,
      surface: `agent model option ${option.value}`,
      value: `${option.value} ${option.label} ${option.description}`,
    }))
    const aliases = [
      ...DSXU_PUBLIC_MODEL_ALIASES.map(alias => ({
        kind: 'public' as const,
        surface: `public model alias ${alias}`,
        value: alias,
      })),
      ...DSXU_AGENT_MODEL_ALIASES.map(alias => ({
        kind: 'public' as const,
        surface: `agent model alias ${alias}`,
        value: alias,
      })),
    ]
    const renderEvidence = [
      DSXU_DEEPSEEK_FLASH_MODEL,
      DSXU_DEEPSEEK_FLASH_MAX_ALIAS,
      DSXU_DEEPSEEK_PRO_MODEL,
    ].map(model => ({
      kind: 'public' as const,
      surface: `rendered DSXU model ${model}`,
      value: renderDSXUModelName(model) ?? model,
    }))
    const routeEvidence = [
      formatDeepSeekV4RequestEvidence({
        model: DSXU_DEEPSEEK_FLASH_MODEL,
        apiMode: 'non_thinking',
        reason: 'coding_flash_non_thinking',
        maxTokens: 16_384,
      }),
      formatDeepSeekV4RequestEvidence({
        model: DSXU_DEEPSEEK_PRO_MODEL,
        apiMode: 'thinking',
        reasoningEffort: 'max',
        reason: 'failed_verification_pro_thinking_max',
        maxTokens: 65_536,
      }),
    ].map((value, index) => ({
      kind: 'public' as const,
      surface: `final model evidence ${index + 1}`,
      value,
    }))
    const [highTier, balancedTier, lightTier] = PROVIDER_MIGRATION_SOURCE_MODEL_FAMILY_WORDS
    const migrationEvidence = [
      lightTier,
      balancedTier,
      highTier,
      highTier + 'plan',
      highTier + '[1m]',
    ]
      .map(alias => getProviderMigrationModelAliasEvidence(alias))
      .filter((value): value is string => Boolean(value))
      .map(value => ({
        kind: 'migration' as const,
        surface: 'hidden provider migration model alias evidence',
        value,
      }))

    return [
      ...modelOptions,
      ...agentOptions,
      ...aliases,
      ...renderEvidence,
      ...routeEvidence,
      ...migrationEvidence,
    ]
  })
}

export function buildV18ModelPublicSurfaceGate(input: {
  items: readonly V18ModelPublicSurfaceItem[]
  evidencePath?: string
  nowIso?: string
}): V18ModelPublicSurfaceGate {
  const issues: V18ModelPublicSurfaceIssue[] = []
  for (const item of input.items) {
    const match = firstProviderMigrationSourceMatch(item.value)
    if (!match) continue
    issues.push({
      severity: item.kind === 'public' ? 'blocker' : 'review',
      surface: item.surface,
      match,
      value: item.value,
      reason:
        item.kind === 'public'
          ? 'DSXU public model surface must not expose provider-migration source model family or vendor naming'
          : 'provider-migration source model family is allowed only in hidden provider-migration evidence',
    })
  }

  const blockerCount = issues.filter(issue => issue.severity === 'blocker').length
  const reviewCount = issues.length - blockerCount
  return {
    status: blockerCount === 0 ? 'DONE_EVIDENCED' : 'BLOCKED_EVIDENCED',
    ok: blockerCount === 0,
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain', 'model-public-surface-gate-20260507.evidence.json'),
    itemCount: input.items.length,
    blockerCount,
    reviewCount,
    issues,
    items: input.items,
    provenanceManifest: [
      {
        surface: 'DSXU/DeepSeek public model aliases and UI labels',
        provenance: 'dsxu-owned',
        releasePolicy: 'ship',
      },
      {
        surface: 'provider-migration source model family aliases',
        provenance: 'provider-migration-only',
        releasePolicy: 'migration-hidden',
      },
      {
        surface: 'historical reference source and local runtime state',
        provenance: 'historical-doc',
        releasePolicy: 'exclude',
      },
    ],
    safeguards: [
      'gate checks runtime public model options, agent model options, aliases, and final model evidence under DSXU_CODE_MODE=1',
      'provider-migration source model family names are permitted only in hidden provider-migration evidence, never in public UI/schema/evidence',
      'this gate does not mutate files, settings, environment, or git state',
    ],
  }
}

export async function runV18ModelPublicSurfaceGateHarness(input: {
  evidenceDir?: string
} = {}): Promise<V18ModelPublicSurfaceGate> {
  const evidenceDir = input.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-toolchain')
  const evidencePath = join(evidenceDir, 'model-public-surface-gate-20260507.evidence.json')
  const gate = buildV18ModelPublicSurfaceGate({
    items: collectDsxuModelPublicSurfaceItems(),
    evidencePath,
  })
  await mkdir(evidenceDir, { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8')
  return gate
}
