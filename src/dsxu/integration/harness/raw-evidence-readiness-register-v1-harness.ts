import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildRawEvidenceReadinessRegister,
  type RawEvidenceReadinessRegister,
} from '../../engine/raw-evidence-readiness-register-v1'
import { runP12RawComparisonHarness } from './phase12-raw-comparison-v1-harness'

export type RawEvidenceReadinessRegisterHarnessResult = RawEvidenceReadinessRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runRawEvidenceReadinessRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
} = {}): Promise<RawEvidenceReadinessRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'raw-evidence-readiness-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'raw-evidence-readiness-register.evidence.json')
  const tracePath = join(evidenceDir, 'raw-evidence-readiness-register.trace.json')
  const p12Report = await runP12RawComparisonHarness({
    evidenceDir: join(evidenceDir, 'p12-raw-comparison'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
  })
  const collectionPack = p12Report.collectionPack
  const register = buildRawEvidenceReadinessRegister({
    p12Report,
    collectionPack,
  })
  const result: RawEvidenceReadinessRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { p12Report, collectionPack, register })
  await writeJson(evidencePath, result)
  return result
}
