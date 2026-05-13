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
  legacyEntrypoints: string[]
  defaultUsesDSXU: boolean
  exposesDSXUBin: boolean
  noDSXULoginRequired: boolean
  legacyRequiresExplicitFlag: boolean
  retiredDSXUDefaultPath: boolean
  violations: string[]
}

export function evaluateDSXUEntrypointPolicy(input: DSXUEntrypointPolicyInput): DSXUEntrypointPolicyReport {
  const scripts = input.packageJson.scripts ?? {}
  const bin = typeof input.packageJson.bin === 'string' ? { dsxu: input.packageJson.bin } : input.packageJson.bin ?? {}
  const start = scripts.start ?? ''
  const launcherText = Object.values(input.launchers ?? {}).join('\n')
  const legacyText = `${scripts['start:legacy-cli'] ?? ''}\n${launcherText}`
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
  const legacyRequiresExplicitFlag =
    !scripts['start:legacy-cli'] ||
    legacyText.includes('DSXU_USE_LEGACY_CLI')
  const retiredDSXUDefaultPath = defaultUsesDSXU && noDSXULoginRequired

  if (!defaultUsesDSXU) violations.push('package start does not use the DSXU Code direct entrypoint')
  if (!exposesDSXUBin) violations.push('package bin does not expose dsxu as the product command')
  if (!noDSXULoginRequired) violations.push('default launcher still configures provider/DSXU login path')
  if (!legacyRequiresExplicitFlag) violations.push('legacy CLI path must be removed or require an explicit legacy flag')

  return {
    defaultProductName: input.packageJson.name ?? '',
    defaultBin: bin.dsxu ?? '',
    defaultScript: start,
    singleApiScript: '',
    defaultEntrypoint: 'src/entrypoints/dsxu-code.tsx',
    legacyEntrypoints: [
      'archived control shell directory',
      'archived session shell directory',
      'archived proxy shell directory',
    ],
    defaultUsesDSXU,
    exposesDSXUBin,
    noDSXULoginRequired,
    legacyRequiresExplicitFlag,
    retiredDSXUDefaultPath,
    violations,
  }
}
