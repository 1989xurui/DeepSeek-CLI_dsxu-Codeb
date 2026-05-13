import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildFinalReleasePreflightRegister,
  type FinalReleasePreflightRegister,
} from '../../engine/final-release-preflight-register-v1'
import { runCleanExportReadinessHarness } from './clean-export-readiness-v1-harness'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'
import { runReleaseClosureBoardHarness } from './release-closure-board-v1-harness'

export type FinalReleasePreflightRegisterHarnessResult = FinalReleasePreflightRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function runFinalReleasePreflightRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  deferredEvalRawLiveManifestPath?: string
  releaseSurfaceSourcePolicyReviewManifestPath?: string
} = {}): Promise<FinalReleasePreflightRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'final-release-preflight-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'final-release-preflight-register.evidence.json')
  const tracePath = join(evidenceDir, 'final-release-preflight-register.trace.json')

  const [board, cleanExport, releaseClosure] = await Promise.all([
    runOwnerGitClosureBoardHarness({
      evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
      targetReferenceManifestPath: options.targetReferenceManifestPath,
      deferredEvalRawLiveManifestPath: options.deferredEvalRawLiveManifestPath,
      releaseSurfaceSourcePolicyReviewManifestPath: options.releaseSurfaceSourcePolicyReviewManifestPath,
    }),
    runCleanExportReadinessHarness({
      evidenceDir: join(evidenceDir, 'clean-export-readiness'),
      targetReferenceManifestPath: options.targetReferenceManifestPath,
      releaseSurfaceSourcePolicyReviewManifestPath: options.releaseSurfaceSourcePolicyReviewManifestPath,
    }),
    runReleaseClosureBoardHarness({
      evidenceDir: join(evidenceDir, 'release-closure-board'),
      targetReferenceManifestPath: options.targetReferenceManifestPath,
      releaseSurfaceSourcePolicyReviewManifestPath: options.releaseSurfaceSourcePolicyReviewManifestPath,
    }),
  ])
  const register = buildFinalReleasePreflightRegister({
    board,
    cleanExport,
    releaseClosure,
  })
  const result: FinalReleasePreflightRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, cleanExport, releaseClosure, register })
  await writeJson(evidencePath, result)
  return result
}
