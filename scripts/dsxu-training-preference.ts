import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildTrainingPreferencePairsReport } from '../src/dsxu/training/preference'

interface CliArgs {
  minPairs: number
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    minPairs: 2000,
    output: 'docs/generated/DSXU_TRAINING_PREFERENCE_PAIRS_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--min-pairs') {
      args.minPairs = Number(argv[index + 1] ?? args.minPairs)
      index += 1
    } else if (argv[index] === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const report = buildTrainingPreferencePairsReport({ minPairs: args.minPairs })
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    pairCount: report.pairCount,
    rejectedReasonCoverage: report.rejectedReasonCoverage,
    publicClaimAllowed: report.publicClaimAllowed,
    output: outputPath,
  }, null, 2))
  if (!Object.values(report.hardGates).every(Boolean)) process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
