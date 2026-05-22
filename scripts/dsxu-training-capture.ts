import { runRuntimeCapture } from '../src/dsxu/training/runtime-capture'

interface CliArgs {
  output?: string
  tracePath?: string
  taskId?: string
  category?: string
  intent?: string
  timeoutMs?: number
  verificationCommand?: string
  verificationPassed: boolean
  claimBound?: boolean
  command: string[]
}

function parseArgs(argv: string[]): CliArgs {
  const separator = argv.indexOf('--')
  const ownArgs = separator >= 0 ? argv.slice(0, separator) : argv
  const command = separator >= 0 ? argv.slice(separator + 1) : []
  const args: CliArgs = { verificationPassed: false, command }
  for (let index = 0; index < ownArgs.length; index += 1) {
    const arg = ownArgs[index]
    if (arg === '--output') {
      args.output = ownArgs[index + 1]
      index += 1
    } else if (arg === '--trace-path') {
      args.tracePath = ownArgs[index + 1]
      index += 1
    } else if (arg === '--task-id') {
      args.taskId = ownArgs[index + 1]
      index += 1
    } else if (arg === '--category') {
      args.category = ownArgs[index + 1]
      index += 1
    } else if (arg === '--intent') {
      args.intent = ownArgs[index + 1]
      index += 1
    } else if (arg === '--timeout-ms') {
      args.timeoutMs = Number(ownArgs[index + 1])
      index += 1
    } else if (arg === '--verification-command') {
      args.verificationCommand = ownArgs[index + 1]
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
  if (args.command.length === 0) {
    throw new Error('usage: bun run scripts/dsxu-training-capture.ts [options] -- <command> [args...]')
  }
  const artifact = await runRuntimeCapture({
    command: args.command,
    outputPath: args.output,
    tracePath: args.tracePath,
    taskId: args.taskId,
    category: args.category,
    intent: args.intent,
    timeoutMs: args.timeoutMs,
    verificationCommand: args.verificationCommand,
    verificationPassed: args.verificationPassed,
    claimBound: args.claimBound,
  })
  console.log(JSON.stringify({
    schemaVersion: artifact.schemaVersion,
    trajectoryCaptured: artifact.trajectoryCaptured,
    validationStatus: artifact.import?.validation.status ?? 'not_captured',
    publicClaimAllowed: artifact.publicClaimAllowed,
    exitCode: artifact.exitCode,
    timedOut: artifact.timedOut,
    tracePath: artifact.tracePath,
    outputPath: artifact.outputPath,
  }, null, 2))
  if (artifact.timedOut || artifact.exitCode !== 0 || artifact.import?.validation.status === 'rejected') process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
