import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { runQueryLoopReachabilityProbe } from '../src/dsxu/training/query-loop-reachability'

interface CliArgs {
  output: string
  task?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_QUERY_LOOP_REACHABILITY_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    } else if (arg === '--task') {
      args.task = argv[index + 1]
      index += 1
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const { artifact } = await runQueryLoopReachabilityProbe({ task: args.task })
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: artifact.schemaVersion,
    output: outputPath,
    validationStatus: artifact.validation.status,
    scoreStatus: artifact.score.status,
    eventCount: artifact.probe.eventCount,
    requiredEventTypesPresent: artifact.probe.requiredEventTypesPresent,
    exitReason: artifact.probe.resultExitReason,
    publicClaimAllowed: artifact.publicClaimAllowed,
  }, null, 2))
  if (
    artifact.validation.status !== 'accepted' ||
    artifact.score.status !== 'scored' ||
    !artifact.probe.requiredEventTypesPresent ||
    artifact.publicClaimAllowed !== false
  ) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
