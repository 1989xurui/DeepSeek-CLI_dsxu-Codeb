import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildOwnerGitReplaceDeleteReviewRegister,
  type OwnerGitReplaceDeleteReviewRegister,
} from '../../engine/owner-git-replace-delete-review-register-v1'
import { runOwnerGitImportUseEvidenceRegisterHarness } from './owner-git-import-use-evidence-register-v1-harness'

export type OwnerGitReplaceDeleteReviewRegisterHarnessResult = OwnerGitReplaceDeleteReviewRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runOwnerGitReplaceDeleteReviewRegisterHarness(options: {
  evidenceDir?: string
} = {}): Promise<OwnerGitReplaceDeleteReviewRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'owner-git-replace-delete-review-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'owner-git-replace-delete-review-register.evidence.json')
  const tracePath = join(evidenceDir, 'owner-git-replace-delete-review-register.trace.json')
  const importUseRegister = await runOwnerGitImportUseEvidenceRegisterHarness({
    evidenceDir: join(evidenceDir, 'owner-git-import-use-evidence-register'),
  })
  const register = buildOwnerGitReplaceDeleteReviewRegister(importUseRegister)
  const result: OwnerGitReplaceDeleteReviewRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { importUseRegister, register })
  await writeJson(evidencePath, result)
  return result
}
