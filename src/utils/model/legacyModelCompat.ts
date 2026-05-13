import {
  DEEPSEEK_V4_FLASH_MODEL,
  type DeepSeekV4Model,
  type DeepSeekV4RouteRole,
} from './deepseekV4Control.js'
import {
  type DsxuPublicModelAlias,
  type LegacyModelCompatAlias,
  isLegacyModelCompatAlias,
} from './aliases.js'

export type LegacyModelCompatResolution = {
  sourceAlias: LegacyModelCompatAlias
  normalizedAlias: string
  model: DeepSeekV4Model
  publicAlias: DsxuPublicModelAlias
  routeRole?: DeepSeekV4RouteRole
  routeIntent:
    | 'lightweight'
    | 'coding'
    | 'planning'
    | 'review'
  contextHint: 'default' | 'one_million'
  costRouterControlled: boolean
  compatibilityOnly: true
}

function stripContextTag(modelInput: string): {
  normalizedAlias: string
  contextHint: 'default' | 'one_million'
} {
  const normalized = modelInput.trim().toLowerCase()
  if (normalized.endsWith('[1m]')) {
    return {
      normalizedAlias: normalized.replace(/\[1m]$/i, ''),
      contextHint: 'one_million',
    }
  }
  return { normalizedAlias: normalized, contextHint: 'default' }
}

export function resolveLegacyModelCompat(
  modelInput: string,
): LegacyModelCompatResolution | null {
  const normalizedInput = modelInput.trim().toLowerCase()
  if (!isLegacyModelCompatAlias(normalizedInput)) return null

  const { normalizedAlias, contextHint } = stripContextTag(normalizedInput)
  switch (normalizedAlias) {
    case 'haiku':
    case 'sonnet':
    case 'fast':
    case 'flash':
      return {
        sourceAlias: normalizedInput,
        normalizedAlias,
        model: DEEPSEEK_V4_FLASH_MODEL,
        publicAlias: 'flash',
        routeRole: normalizedAlias === 'haiku' || normalizedAlias === 'fast' ? 'classifier' : 'coder',
        routeIntent: normalizedAlias === 'haiku' || normalizedAlias === 'fast' ? 'lightweight' : 'coding',
        contextHint,
        costRouterControlled: false,
        compatibilityOnly: true,
      }
    case 'opus':
    case 'opusplan':
    case 'best':
      return {
        sourceAlias: normalizedInput,
        normalizedAlias,
        model: DEEPSEEK_V4_FLASH_MODEL,
        publicAlias: 'flash-max',
        routeRole: normalizedAlias === 'opusplan' ? 'planner' : 'reviewer',
        routeIntent: normalizedAlias === 'opusplan' ? 'planning' : 'review',
        contextHint,
        costRouterControlled: true,
        compatibilityOnly: true,
      }
    default:
      return null
  }
}

export function getLegacyModelCompatEvidence(modelInput: string): string | null {
  const resolution = resolveLegacyModelCompat(modelInput)
  if (!resolution) return null
  const context = resolution.contextHint === 'one_million' ? '; context_hint=1m' : ''
  const router = resolution.costRouterControlled ? '; cost_router_decides=true' : ''
  return `DSXU legacy model compat: ${resolution.sourceAlias} -> ${resolution.publicAlias}; route_intent=${resolution.routeIntent}; compatibility_only=true${context}${router}.`
}
