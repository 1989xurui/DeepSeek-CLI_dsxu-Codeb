import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { buildDatasetValidationReport } from '../src/dsxu/training/validator'

interface CliArgs {
  input: string
  output?: string
  strict: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { input: '.dsxu/training', strict: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input') {
      args.input = argv[index + 1] ?? args.input
      index += 1
    } else if (arg === '--output') {
      args.output = argv[index + 1]
      index += 1
    } else if (arg === '--strict') {
      args.strict = true
    }
  }
  return args
}

async function readJsonFiles(inputPath: string): Promise<readonly { path: string; value: unknown }[]> {
  if (!existsSync(inputPath)) return []
  const inputStat = await stat(inputPath)
  if (inputStat.isFile()) {
    const raw = await readFile(inputPath, 'utf8')
    return [{ path: inputPath, value: JSON.parse(raw) }]
  }
  const entries = await readdir(inputPath, { withFileTypes: true })
  const items: { path: string; value: unknown }[] = []
  for (const entry of entries) {
    const fullPath = join(inputPath, entry.name)
    if (entry.isDirectory()) {
      items.push(...await readJsonFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const raw = await readFile(fullPath, 'utf8')
      items.push({ path: fullPath, value: JSON.parse(raw) })
    }
  }
  return items
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = resolve(args.input)
  const items = await readJsonFiles(inputPath)
  const report = buildDatasetValidationReport({ inputPath, strict: args.strict, items })
  const payload = `${JSON.stringify(report, null, 2)}\n`
  if (args.output) {
    const outputPath = resolve(args.output)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, payload, 'utf8')
  } else {
    console.log(payload)
  }

  if (args.strict && report.status !== 'PASS') process.exit(1)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
