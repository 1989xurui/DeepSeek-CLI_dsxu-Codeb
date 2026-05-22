import { buildTrainingEvidenceDashboardFromFiles } from '../src/dsxu/training/dashboard'

interface CliArgs {
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_EVIDENCE_DASHBOARD_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const dashboard = await buildTrainingEvidenceDashboardFromFiles({
    outputPath: args.output,
  })
  console.log(JSON.stringify({
    schemaVersion: dashboard.schemaVersion,
    output: args.output,
    evidenceCompletenessScore: dashboard.evidenceCompletenessScore,
    publicClaimAllowed: dashboard.publicClaimAllowed,
    offlineV1Status: dashboard.summary.offlineV1Status,
    liveProviderStatus: dashboard.summary.liveProviderStatus,
    allowedInternalClaims: dashboard.claimGates
      .filter(gate => gate.status === 'allowed-internal')
      .map(gate => gate.id),
    blockedOrMissingClaims: dashboard.claimGates
      .filter(gate => gate.status !== 'allowed-internal')
      .map(gate => ({ id: gate.id, status: gate.status })),
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
