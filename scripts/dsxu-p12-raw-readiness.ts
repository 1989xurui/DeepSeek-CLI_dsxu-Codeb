import { existsSync } from 'fs'
import { resolve } from 'path'
import { autoDiscoverP12TargetReferenceManifest, DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH } from '../src/dsxu/engine/p12-target-reference-manifest-autodiscovery'
import { runRawEvidenceReadinessRegisterHarness } from '../src/dsxu/integration/harness/raw-evidence-readiness-register-v1-harness'

type P12RawReadinessCliOptions = {
  targetReferenceManifestPath?: string
  deferredEvalRawLiveManifestPath?: string
  evidenceDir?: string
  failOnBlocked: boolean
  help: boolean
}

function usage(): string {
  return [
    'DSXU P12 raw evidence readiness',
    '',
    'Usage:',
    '  bun run scripts/dsxu-p12-raw-readiness.ts [options]',
    '',
    'Options:',
    '  --targetReferenceManifestPath <path>       Import real target-reference raw log manifest.',
    '  --target-reference-manifest <path>         Alias for --targetReferenceManifestPath.',
    '  --deferredEvalRawLiveManifestPath <path>   Import deferred eval raw/live manifest.',
    '  --deferred-eval-raw-live-manifest <path>   Alias for --deferredEvalRawLiveManifestPath.',
    '  --evidenceDir <path>                       Output evidence directory.',
    '  --fail-on-blocked                         Exit 2 when readiness remains BLOCKED.',
    '  --help                                    Show this help.',
    '',
    'Rules:',
    '  - This script imports and validates evidence only.',
    '  - It never fabricates target-reference logs.',
    '  - Templates, dry plans, generic logs, and target-only logs do not count as P12 PASS.',
    '  - If no targetReferenceManifestPath is provided, it may reuse a READY discovery report canonical manifest.',
  ].join('\n')
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a path value`)
  }
  return value
}

function parseArgs(args: string[]): P12RawReadinessCliOptions {
  const options: P12RawReadinessCliOptions = {
    failOnBlocked: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--fail-on-blocked') {
      options.failOnBlocked = true
      continue
    }
    if (arg === '--targetReferenceManifestPath' || arg === '--target-reference-manifest') {
      options.targetReferenceManifestPath = readValue(args, index, arg)
      index += 1
      continue
    }
    if (arg.startsWith('--targetReferenceManifestPath=')) {
      options.targetReferenceManifestPath = arg.slice('--targetReferenceManifestPath='.length)
      continue
    }
    if (arg.startsWith('--target-reference-manifest=')) {
      options.targetReferenceManifestPath = arg.slice('--target-reference-manifest='.length)
      continue
    }
    if (arg === '--deferredEvalRawLiveManifestPath' || arg === '--deferred-eval-raw-live-manifest') {
      options.deferredEvalRawLiveManifestPath = readValue(args, index, arg)
      index += 1
      continue
    }
    if (arg.startsWith('--deferredEvalRawLiveManifestPath=')) {
      options.deferredEvalRawLiveManifestPath = arg.slice('--deferredEvalRawLiveManifestPath='.length)
      continue
    }
    if (arg.startsWith('--deferred-eval-raw-live-manifest=')) {
      options.deferredEvalRawLiveManifestPath = arg.slice('--deferred-eval-raw-live-manifest='.length)
      continue
    }
    if (arg === '--evidenceDir') {
      options.evidenceDir = readValue(args, index, arg)
      index += 1
      continue
    }
    if (arg.startsWith('--evidenceDir=')) {
      options.evidenceDir = arg.slice('--evidenceDir='.length)
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function assertExistingInput(path: string | undefined, label: string): string | undefined {
  if (!path) return undefined
  const absolute = resolve(path)
  if (!existsSync(absolute)) {
    throw new Error(`${label} does not exist: ${absolute}`)
  }
  return absolute
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const explicitTargetReferenceManifestPath = assertExistingInput(
    options.targetReferenceManifestPath,
    'targetReferenceManifestPath',
  )
  const autoDiscovery = explicitTargetReferenceManifestPath
    ? {
      discoveryPath: resolve(process.cwd(), DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH),
      reason: 'explicit-target-reference-manifest-provided',
    }
    : await autoDiscoverP12TargetReferenceManifest()
  const targetReferenceManifestPath = explicitTargetReferenceManifestPath ?? autoDiscovery.path
  const deferredEvalRawLiveManifestPath = assertExistingInput(
    options.deferredEvalRawLiveManifestPath,
    'deferredEvalRawLiveManifestPath',
  )
  const result = await runRawEvidenceReadinessRegisterHarness({
    evidenceDir: options.evidenceDir ? resolve(options.evidenceDir) : undefined,
    targetReferenceManifestPath,
    deferredEvalRawLiveManifestPath,
  })
  const summary = {
    schemaVersion: 'dsxu.p12.raw-readiness-cli.v1',
    status: result.status,
    targetReferenceManifestPath: targetReferenceManifestPath ?? null,
    targetReferenceManifestSource: explicitTargetReferenceManifestPath
      ? 'explicit'
      : autoDiscovery.path
        ? 'auto-discovered'
        : 'missing',
    targetReferenceManifestDiscoveryPath: autoDiscovery.discoveryPath,
    targetReferenceManifestDiscoveryReason: autoDiscovery.reason,
    p12Status: result.p12Status,
    deferredEvalStatus: result.deferredEvalStatus,
    p12PairedRawLogCount: result.p12PairedRawLogCount,
    p12MinimumPairedRawLogsForPass: result.p12MinimumPairedRawLogsForPass,
    p12ReplayFamilyGapCount: result.p12ReplayFamilyGapCount,
    p12RequiredAdditionalSameTaskPairCount: result.p12RequiredAdditionalSameTaskPairCount,
    deferredEvalWaitingRawLiveCount: result.deferredEvalWaitingRawLiveCount,
    mustNotClaimComparisonWin: result.mustNotClaimComparisonWin,
    nextAction: result.nextAction,
    evidencePath: result.evidencePath,
    tracePath: result.tracePath,
    blockers: result.blockers,
  }

  console.log(JSON.stringify(summary, null, 2))
  if (options.failOnBlocked && result.status === 'BLOCKED') {
    process.exitCode = 2
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
