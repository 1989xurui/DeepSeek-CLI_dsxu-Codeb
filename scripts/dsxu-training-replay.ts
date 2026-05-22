import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildTrainingReplayReport, type DsxuTrainingReplaySuite } from '../src/dsxu/training/replay'

interface CliArgs {
  suite: DsxuTrainingReplaySuite
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    suite: 'core-300',
    output: 'docs/generated/DSXU_TRAINING_REPLAY_RUN_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--suite') {
      args.suite = (argv[index + 1] ?? args.suite) as DsxuTrainingReplaySuite
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
  const report = buildTrainingReplayReport(args.suite)
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    status: report.status,
    suite: report.suite,
    sampleCount: report.sampleCount,
    publicClaimAllowed: report.publicClaimAllowed,
    output: outputPath,
  }, null, 2))
  if (report.status !== 'PASS_INTERNAL_SYNTHETIC_REPLAY') process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
