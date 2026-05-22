export interface DSXUEntrypointPolicyInput {
  packageJson: {
    name?: string
    bin?: Record<string, string> | string
    scripts?: Record<string, string>
  }
  launchers?: Record<string, string>
}

export interface DSXUEntrypointPolicyReport {
  defaultProductName: string
  defaultBin: string
  defaultScript: string
  singleApiScript: string
  defaultEntrypoint: string
  providerMigrationEntrypoints: string[]
  defaultUsesDSXU: boolean
  exposesDSXUBin: boolean
  noDSXULoginRequired: boolean
  providerMigrationRequiresExplicitFlag: boolean
  retiredDSXUDefaultPath: boolean
  violations: string[]
}

export function evaluateDSXUEntrypointPolicy(input: DSXUEntrypointPolicyInput): DSXUEntrypointPolicyReport {
  const scripts = input.packageJson.scripts ?? {}
  const bin = typeof input.packageJson.bin === 'string' ? { dsxu: input.packageJson.bin } : input.packageJson.bin ?? {}
  const start = scripts.start ?? ''
  const launcherText = Object.values(input.launchers ?? {}).join('\n')
  const providerMigrationEntrypointText =
    `${scripts['start:provider-migration-cli'] ?? ''}\n${launcherText}`
  const violations: string[] = []

  const defaultUsesDSXU =
    start.includes('src/entrypoints/dsxu-code.tsx') ||
    start.includes('bin/dsxu-code')
  const exposesDSXUBin =
    (bin.dsxu === './bin/dsxu-code' || bin.dsxu === 'bin/dsxu-code') &&
    (bin['dsxu-code'] === './bin/dsxu-code' || bin['dsxu-code'] === 'bin/dsxu-code')
  const noDSXULoginRequired =
    !start.includes('PROVIDER_') &&
    !launcherText.includes('PROVIDER_BASE_URL') &&
    !launcherText.includes('PROVIDER_API_KEY')
  const providerMigrationRequiresExplicitFlag =
    !scripts['start:provider-migration-cli'] ||
    providerMigrationEntrypointText.includes('DSXU_USE_PROVIDER_MIGRATION_CLI')
  const retiredDSXUDefaultPath = defaultUsesDSXU && noDSXULoginRequired

  if (!defaultUsesDSXU) violations.push('package start does not use the DSXU Code direct entrypoint')
  if (!exposesDSXUBin) violations.push('package bin does not expose dsxu as the product command')
  if (!noDSXULoginRequired) violations.push('default launcher still configures provider/DSXU login path')
  if (!providerMigrationRequiresExplicitFlag) violations.push('archived CLI path must be removed or require an explicit archived flag')

  return {
    defaultProductName: input.packageJson.name ?? '',
    defaultBin: bin.dsxu ?? '',
    defaultScript: start,
    singleApiScript: '',
    defaultEntrypoint: 'src/entrypoints/dsxu-code.tsx',
    providerMigrationEntrypoints: [
      'archived control shell directory',
      'archived session shell directory',
      'archived proxy shell directory',
    ],
    defaultUsesDSXU,
    exposesDSXUBin,
    noDSXULoginRequired,
    providerMigrationRequiresExplicitFlag,
    retiredDSXUDefaultPath,
    violations,
  }
}
