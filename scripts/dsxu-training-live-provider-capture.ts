import { runLiveProviderCaptureSmoke } from '../src/dsxu/training/live-provider-capture'

interface CliArgs {
  output: string
  trace: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
  requireLive: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_LIVE_PROVIDER_CAPTURE_20260520.json',
    trace: '.dsxu/training/live-provider/deepseek-live-provider-smoke-20260520.jsonl',
    requireLive: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    } else if (arg === '--trace') {
      args.trace = argv[index + 1] ?? args.trace
      index += 1
    } else if (arg === '--model') {
      args.model = argv[index + 1]
      index += 1
    } else if (arg === '--base-url') {
      args.baseUrl = argv[index + 1]
      index += 1
    } else if (arg === '--timeout-ms') {
      const value = Number(argv[index + 1])
      args.timeoutMs = Number.isFinite(value) && value > 0 ? value : args.timeoutMs
      index += 1
    } else if (arg === '--require-live') {
      args.requireLive = true
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const artifact = await runLiveProviderCaptureSmoke({
    outputPath: args.output,
    tracePath: args.trace,
    model: args.model,
    baseUrl: args.baseUrl,
    timeoutMs: args.timeoutMs,
    requireLive: args.requireLive,
  })

  console.log(JSON.stringify({
    schemaVersion: artifact.schemaVersion,
    status: artifact.status,
    output: artifact.outputPath,
    trace: artifact.tracePath,
    provider: artifact.provider,
    model: artifact.model,
    baseUrlHost: artifact.baseUrlHost,
    liveProviderAttempted: artifact.liveProviderAttempted,
    validationStatus: artifact.import?.validation.status,
    scoreStatus: artifact.import?.score.status,
    recordCount: artifact.import?.summary.recordCount ?? 0,
    requestCount: artifact.import?.summary.requestCount ?? 0,
    publicClaimAllowed: artifact.publicClaimAllowed,
    liveProviderClaimAllowed: artifact.liveProviderClaimAllowed,
  }, null, 2))

  if (artifact.status === 'FAIL_LIVE_PROVIDER_CAPTURE' || (args.requireLive && artifact.status !== 'PASS_LIVE_PROVIDER_CAPTURE')) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
