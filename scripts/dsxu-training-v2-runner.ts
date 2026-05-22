import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildTrainingV2RunnerReport } from '../src/dsxu/training/v2-runner'

interface CliArgs {
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_DATA_FLYWHEEL_V2_RUN_20260520.json',
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
  const report = buildTrainingV2RunnerReport()
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    status: report.status,
    publicClaimAllowed: report.publicClaimAllowed,
    stageCount: report.stages.length,
    failedStages: report.stages.filter(stage => !stage.passed).map(stage => stage.id),
    failedGlobalGates: report.globalHardGates.filter(gate => !gate.passed).map(gate => gate.id),
    output: outputPath,
  }, null, 2))
  if (report.status !== 'PASS_INTERNAL_TRAINING_FLYWHEEL') process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
