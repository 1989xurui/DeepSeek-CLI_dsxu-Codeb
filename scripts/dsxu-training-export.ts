import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createDryRunTrainingTrajectory } from '../src/dsxu/training/exporter'

interface CliArgs {
  dryRun: boolean
  output?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--output') {
      args.output = argv[index + 1]
      index += 1
    }
  }
  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dryRun) {
    throw new Error('Only --dry-run is implemented in Phase 1. Runtime export wiring is intentionally deferred.')
  }

  const result = createDryRunTrainingTrajectory()
  if (!result.validation.ok) {
    throw new Error(`dry-run trajectory failed validation: ${result.validation.errors.join('; ')}`)
  }

  const payload = `${JSON.stringify(result.trajectory, null, 2)}\n`
  if (args.output) {
    const outputPath = resolve(args.output)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, payload, 'utf8')
    console.log(`Wrote ${outputPath}`)
  } else {
    console.log(payload)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
