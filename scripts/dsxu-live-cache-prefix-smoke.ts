import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { writeV19LiveProviderCacheEvidenceSummary } from '../src/dsxu/engine/cost-cache-live-task-evidence'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_LIVE_CACHE_PREFIX_SMOKE_20260515.json')
const SOURCE_EVIDENCE_PATH = join(process.cwd(), '.dsxu', 'trace', 'v18-live-provider', 'live-cache-prefix-payload-smoke.json')
const SUMMARY_PATH = join(process.cwd(), '.dsxu', 'trace', 'v19-cost-cache-live-provider', 'live-provider-cache-prefix-summary.json')

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

async function main(): Promise<void> {
  const source = await readJsonIfExists(SOURCE_EVIDENCE_PATH)
  const summary = source
    ? await writeV19LiveProviderCacheEvidenceSummary({
        sourceEvidencePath: SOURCE_EVIDENCE_PATH,
        evidencePath: SUMMARY_PATH,
      })
    : null
  const report = {
    schemaVersion: 'dsxu.v20.live-cache-prefix-smoke.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: summary?.ok
      ? 'DONE_EVIDENCED'
      : source
        ? 'BLOCKED_EVIDENCED_SOURCE_SUMMARY_FAILED'
        : 'BLOCKED_EVIDENCED_MISSING_LIVE_PROVIDER_PAYLOAD',
    didCallProvider: false,
    didFabricateLiveResult: false,
    sourceEvidencePath: SOURCE_EVIDENCE_PATH,
    summaryPath: SUMMARY_PATH,
    sourceEvidenceExists: source !== null,
    summary,
    nextAction: summary?.ok
      ? 'use this live cache prefix evidence in performance review'
      : 'run a real DeepSeek cache-prefix payload smoke before claiming live cache performance',
    rule: 'This smoke ingests real provider payload evidence when present. It does not fabricate cache-hit usage or call a model.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    sourceEvidenceExists: report.sourceEvidenceExists,
    didCallProvider: report.didCallProvider,
    outputJson: OUTPUT_JSON_PATH,
  }, null, 2))
}

await main()
