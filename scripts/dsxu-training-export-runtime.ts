import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { exportTrainingTrajectoryFromRuntimeFile } from '../src/dsxu/training/runtime-importer'
import { validateTrainingTrajectory } from '../src/dsxu/training/validator'

interface CliArgs {
  input?: string
  output: string
  taskId?: string
  category?: string
  intent?: string
  verificationCommand?: string
  verificationPassed: boolean
  claimBound?: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    output: 'docs/generated/DSXU_TRAINING_RUNTIME_IMPORT_20260520.json',
    verificationPassed: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      args.input = argv[index + 1]
      index += 1
    } else if (arg === '--output') {
      args.output = argv[index + 1] ?? args.output
      index += 1
    } else if (arg === '--task-id') {
      args.taskId = argv[index + 1]
      index += 1
    } else if (arg === '--category') {
      args.category = argv[index + 1]
      index += 1
    } else if (arg === '--intent') {
      args.intent = argv[index + 1]
      index += 1
    } else if (arg === '--verification-command') {
      args.verificationCommand = argv[index + 1]
      index += 1
    } else if (arg === '--verification-passed') {
      args.verificationPassed = true
    } else if (arg === '--claim-bound') {
      args.claimBound = true
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input) throw new Error('--input <trajectory.jsonl> is required')

  const result = await exportTrainingTrajectoryFromRuntimeFile(resolve(args.input), {
    taskId: args.taskId,
    category: args.category,
    intent: args.intent,
    verificationCommands: args.verificationCommand ? [args.verificationCommand] : [],
    verificationPassed: args.verificationPassed,
    claimBound: args.claimBound ?? args.verificationPassed,
  })
  const validation = validateTrainingTrajectory(result.trajectory)
  const output = {
    schemaVersion: 'dsxu.training-runtime-import-artifact.v1',
    generatedAt: new Date().toISOString(),
    datasetKind: 'runtime_evidence_import',
    publicClaimAllowed: false,
    summary: result.summary,
    validation,
    trajectory: result.trajectory,
  }
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: output.schemaVersion,
    output: outputPath,
    validationStatus: validation.status,
    publicClaimAllowed: false,
    recordCount: result.summary.recordCount,
    requestCount: result.summary.requestCount,
    toolCallCount: result.summary.toolCallCount,
  }, null, 2))
  if (validation.status !== 'accepted') process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
