import { describe, expect, test } from 'bun:test'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'
import { parseDSXUModelAlias, renderDSXUModelName } from '../../../utils/model/dsxuModel'
import {
  getLegacyModelCompatEvidence,
  resolveLegacyModelCompat,
} from '../../../utils/model/legacyModelCompat'

describe('legacy model compat isolation V1', () => {
  test('maps old lightweight/default aliases into DSXU Flash without public leakage', () => {
    expect(resolveLegacyModelCompat('haiku')?.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(resolveLegacyModelCompat('sonnet')?.publicAlias).toBe('flash')
    expect(parseDSXUModelAlias('sonnet[1m]')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('sonnet')).toBe('DeepSeek V4 Flash')
  })

  test('maps old high-tier aliases into DSXU Flash-MAX route intent, not direct Pro', () => {
    expect(resolveLegacyModelCompat('opus')?.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(resolveLegacyModelCompat('opus')?.publicAlias).toBe('flash-max')
    expect(resolveLegacyModelCompat('opus')?.costRouterControlled).toBe(true)
    expect(resolveLegacyModelCompat('opusplan')?.routeRole).toBe('planner')
    expect(parseDSXUModelAlias('opus[1m]')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('opusplan')).toBe('DeepSeek V4 Flash-MAX')
  })

  test('keeps compatibility evidence explicitly hidden', () => {
    const evidence = getLegacyModelCompatEvidence('opus[1m]')

    expect(evidence).toContain('compatibility_only=true')
    expect(evidence).toContain('context_hint=1m')
    expect(evidence).toContain('cost_router_decides=true')
  })

  test('renders Flash-MAX as DSXU public surface while resolving to Flash model', () => {
    expect(parseDSXUModelAlias('flash-max')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('flash-max')).toBe('DeepSeek V4 Flash-MAX')
  })
})
