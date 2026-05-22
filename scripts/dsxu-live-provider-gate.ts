import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { writeLiveProviderGateEvidence } from '../src/dsxu/integration/harness/live-provider-gate-v1-harness'
import { getV18LiveDeepSeekBenchmarkGate } from '../src/dsxu/engine/v18-live-deepseek-benchmark-gate'

const GENERATED_DIR = join(process.cwd(), 'docs', 'generated')
const OUTPUT_JSON_PATH = join(GENERATED_DIR, 'DSXU_V20_LIVE_PROVIDER_GATE_20260515.json')

async function main(): Promise<void> {
  const currentProcess = await writeLiveProviderGateEvidence({
    evidencePath: join(process.cwd(), '.dsxu', 'trace', 'v18-live-provider', 'live-provider-gate.json'),
  })
  const wsl = await writeLiveProviderGateEvidence({
    executionTarget: 'wsl',
    evidencePath: join(process.cwd(), '.dsxu', 'trace', 'v18-live-provider', 'live-provider-gate-wsl.json'),
  })
  const benchmarkGate = getV18LiveDeepSeekBenchmarkGate(process.env)
  const report = {
    schemaVersion: 'dsxu.v20.live-provider-gate.v1',
    generatedAt: new Date().toISOString(),
    repoRoot: resolve(process.cwd()),
    status: currentProcess.ok || wsl.ok ? 'READY_FOR_SCOPED_LIVE_REPLAY' : 'BLOCKED_EVIDENCED_NO_PROVIDER_CREDENTIAL',
    didCallProvider: false,
    didFabricateLiveResult: false,
    currentProcess,
    wsl,
    benchmarkGate,
    nextAction: currentProcess.ok || wsl.ok
      ? 'run scoped live replay; keep Flash-first and Pro only for planning/recovery/failed verification'
      : 'keep deterministic replay evidence and configure DeepSeek/DSXU credentials before claiming live provider behavior',
    rule: 'This gate checks provider readiness and writes evidence only. It does not call a model or mark live performance DONE.',
  }
  await mkdir(dirname(OUTPUT_JSON_PATH), { recursive: true })
  await writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    currentProcessStatus: currentProcess.status,
    wslStatus: wsl.status,
    didCallProvider: report.didCallProvider,
    outputJson: OUTPUT_JSON_PATH,
  }, null, 2))
}

await main()
