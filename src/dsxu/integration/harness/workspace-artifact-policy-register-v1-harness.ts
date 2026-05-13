import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildWorkspaceArtifactPolicyRegister,
  type WorkspaceArtifactPolicyRegister,
  validateWorkspacePermissionResidueClosureManifest,
} from '../../engine/workspace-artifact-policy-register-v1'
import { runOwnerGitClosureBoardHarness } from './owner-git-closure-board-v1-harness'

export type WorkspaceArtifactPolicyRegisterHarnessResult = WorkspaceArtifactPolicyRegister & {
  evidencePath: string
  tracePath: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    return await readJson(path)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

export async function runWorkspaceArtifactPolicyRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  permissionResidueClosureManifestPath?: string
} = {}): Promise<WorkspaceArtifactPolicyRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'workspace-artifact-policy-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'workspace-artifact-policy-register.evidence.json')
  const tracePath = join(evidenceDir, 'workspace-artifact-policy-register.trace.json')
  const board = await runOwnerGitClosureBoardHarness({
    evidenceDir: join(evidenceDir, 'owner-git-closure-board'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
    permissionResidueClosureManifestPath: options.permissionResidueClosureManifestPath,
  })
  const permissionResidueClosureManifestPath = options.permissionResidueClosureManifestPath ??
    join(process.cwd(), '.dsxu', 'trace', 'workspace-permission-residue-closure-v1', 'workspace-permission-residue-closure-manifest.json')
  const permissionResidueClosureManifestInput = permissionResidueClosureManifestPath
    ? await readJsonIfExists(permissionResidueClosureManifestPath)
    : null
  const permissionResidueClosureManifest = permissionResidueClosureManifestInput
    ? validateWorkspacePermissionResidueClosureManifest(permissionResidueClosureManifestInput)
    : undefined
  const register = buildWorkspaceArtifactPolicyRegister(board, { permissionResidueClosureManifest })
  const result: WorkspaceArtifactPolicyRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, { board, permissionResidueClosureManifest, register })
  await writeJson(evidencePath, result)
  return result
}
