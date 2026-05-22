import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildTrainingV2DatasetManifest } from '../src/dsxu/training/dataset-manifest'

interface CliArgs {
  trajectoryMin: number
  preferencePairsMin: number
  output: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    trajectoryMin: 980,
    preferencePairsMin: 2000,
    output: 'docs/generated/DSXU_TRAINING_V2_DATASET_MANIFEST_20260520.json',
  }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--trajectory-min') {
      args.trajectoryMin = Number(argv[index + 1] ?? args.trajectoryMin)
      index += 1
    } else if (argv[index] === '--preference-pairs-min') {
      args.preferencePairsMin = Number(argv[index + 1] ?? args.preferencePairsMin)
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
  const manifest = buildTrainingV2DatasetManifest({
    trajectoryMin: args.trajectoryMin,
    preferencePairsMin: args.preferencePairsMin,
  })
  const outputPath = resolve(args.output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    trajectoryCount: manifest.trajectoryCount,
    preferencePairCount: manifest.preferencePairCount,
    goldRatio: manifest.qualitySummary.goldRatio,
    publicClaimAllowed: manifest.publicClaimAllowed,
    output: outputPath,
  }, null, 2))
  if (!Object.values(manifest.hardGates).every(Boolean)) process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
