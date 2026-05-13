import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildOwnerGitMainlineKeepReviewRegister,
  type OwnerGitMainlineKeepReviewRegister,
} from '../../engine/owner-git-mainline-keep-review-register-v1'
import { runOwnerGitImportUseEvidenceRegisterHarness } from './owner-git-import-use-evidence-register-v1-harness'

export type OwnerGitMainlineKeepReviewRegisterHarnessResult = OwnerGitMainlineKeepReviewRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runOwnerGitMainlineKeepReviewRegisterHarness(options: {
  evidenceDir?: string
} = {}): Promise<OwnerGitMainlineKeepReviewRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'owner-git-mainline-keep-review-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'owner-git-mainline-keep-review-register.evidence.json')
  const tracePath = join(evidenceDir, 'owner-git-mainline-keep-review-register.trace.json')
  const importUseRegister = await runOwnerGitImportUseEvidenceRegisterHarness({
    evidenceDir: join(evidenceDir, 'owner-git-import-use-evidence-register'),
  })
  const register = buildOwnerGitMainlineKeepReviewRegister(importUseRegister)
  const result: OwnerGitMainlineKeepReviewRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { importUseRegister, register })
  await writeJson(evidencePath, result)
  return result
}
