import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'
import { parseDSXUModelAlias, renderDSXUModelName } from '../../../utils/model/dsxuModel'
import {
  getProviderMigrationModelAliasEvidence,
  resolveProviderMigrationModelAlias,
} from '../../../utils/model/providerMigration/providerMigrationModelCompat'

describe('provider migration model alias isolation V1', () => {
  test('maps old lightweight/default aliases into DSXU Flash without public leakage', () => {
    expect(resolveProviderMigrationModelAlias('haiku')?.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(resolveProviderMigrationModelAlias('sonnet')?.publicAlias).toBe('flash')
    expect(parseDSXUModelAlias('sonnet[1m]')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('sonnet')).toBe('DeepSeek V4 Flash')
  })

  test('maps old high-tier aliases into DSXU Flash-MAX route intent, not direct Pro', () => {
    expect(resolveProviderMigrationModelAlias('opus')?.model).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(resolveProviderMigrationModelAlias('opus')?.publicAlias).toBe('flash-max')
    expect(resolveProviderMigrationModelAlias('opus')?.costRouterControlled).toBe(true)
    expect(resolveProviderMigrationModelAlias('opusplan')?.routeRole).toBe('planner')
    expect(parseDSXUModelAlias('opus[1m]')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('opusplan')).toBe('DeepSeek V4 Flash-MAX')
  })

  test('keeps compatibility evidence explicitly hidden', () => {
    const evidence = getProviderMigrationModelAliasEvidence('opus[1m]')

    expect(evidence).toContain('projection_only=true')
    expect(evidence).toContain('context_hint=1m')
    expect(evidence).toContain('cost_router_decides=true')
  })

  test('renders Flash-MAX as DSXU public surface while resolving to Flash model', () => {
    expect(parseDSXUModelAlias('flash-max')).toBe(DEEPSEEK_V4_FLASH_MODEL)
    expect(renderDSXUModelName('flash-max')).toBe('DeepSeek V4 Flash-MAX')
  })

  test('keeps DSXU mainline on DeepSeekAdapter before provider SDK fallback', () => {
    const clientSource = readFileSync('src/services/api/client.ts', 'utf8')
    const dsxuBranch = clientSource.indexOf('if (shouldUseDsxuDeepSeekClient())')
    const providerSdkBranch = clientSource.indexOf('return new ProviderClient')

    expect(dsxuBranch).toBeGreaterThanOrEqual(0)
    expect(providerSdkBranch).toBeGreaterThan(dsxuBranch)
    expect(clientSource.slice(dsxuBranch, providerSdkBranch)).toContain(
      'DeepSeekAdapter.transformRequest',
    )
    expect(clientSource).toContain('isDSXUCodeMode() || !isProviderMigrationServiceShellAllowed()')
    expect(clientSource).toContain('DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1')

    const facadeSource = readFileSync('src/services/api/dsxu-model.ts', 'utf8')
    expect(facadeSource).not.toContain(['Source', 'Provider'].join(''))
  })

  test('keeps primary model fallback behind DSXU or provider-migration owner gates', () => {
    const retrySource = readFileSync('src/services/api/withRetry.ts', 'utf8')

    expect(retrySource).toContain('function isPrimaryModelFallbackAllowed(model: string)')
    expect(retrySource).toContain('DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS')
    expect(retrySource).toContain("isDsxuCodeEnvTruthy('ALLOW_PROVIDER_MODEL_FALLBACKS')")
    expect(retrySource).toContain('if (!isProviderMigrationServiceShellAllowed())')
    expect(retrySource).toContain('return false')
    expect(retrySource).toContain('Boolean(process.env.FALLBACK_FOR_ALL_PRIMARY_MODELS)')
  })
})
