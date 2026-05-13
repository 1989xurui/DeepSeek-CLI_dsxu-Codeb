import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import {
  buildOwnerGitImportUseEvidenceRegister,
  type OwnerGitImportUseEvidenceRegister,
  type OwnerGitSampleUsageEvidence,
} from '../../engine/owner-git-import-use-evidence-register-v1'
import { runOwnerGitSignoffRegisterHarness } from './owner-git-signoff-register-v1-harness'

export type OwnerGitImportUseEvidenceRegisterHarnessResult = OwnerGitImportUseEvidenceRegister & {
  evidencePath: string
  tracePath: string
}

type SourceFile = {
  path: string
  content: string
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(path)
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return []
    return [path]
  }))
  return nested.flat()
}

function tokenForPath(path: string): string {
  const name = basename(path)
  return name.slice(0, name.length - extname(name).length)
}

function hasImportForToken(content: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:from\\s+['"][^'"]*${escaped}|import\\s*\\(\\s*['"][^'"]*${escaped})`).test(content)
}

async function collectSourceFiles(rootDir: string): Promise<SourceFile[]> {
  const files = await listSourceFiles(join(rootDir, 'src', 'dsxu'))
  return Promise.all(files.map(async path => ({
    path: normalizePath(path.replace(`${rootDir}\\`, '').replace(`${rootDir}/`, '')),
    content: await readFile(path, 'utf8'),
  })))
}

function buildSampleUsageEvidence(
  rootDir: string,
  samplePaths: readonly string[],
  sourceFiles: readonly SourceFile[],
): readonly OwnerGitSampleUsageEvidence[] {
  return samplePaths.map(path => {
    const normalized = normalizePath(path)
    const absolutePath = join(rootDir, normalized)
    const token = tokenForPath(normalized)
    const importerPaths = sourceFiles
      .filter(file => file.path !== normalized && hasImportForToken(file.content, token))
      .map(file => file.path)
      .slice(0, 12)
    const referencePaths = sourceFiles
      .filter(file => file.path !== normalized && file.content.includes(token))
      .map(file => file.path)
      .slice(0, 12)

    return {
      path: normalized,
      exists: existsSync(absolutePath),
      importerPaths,
      referencePaths,
    }
  })
}

export async function runOwnerGitImportUseEvidenceRegisterHarness(options: {
  evidenceDir?: string
  targetReferenceManifestPath?: string
  ownerGitReviewManifestPath?: string
} = {}): Promise<OwnerGitImportUseEvidenceRegisterHarnessResult> {
  const evidenceDir = options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'owner-git-import-use-evidence-register-v1')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(evidenceDir, 'owner-git-import-use-evidence-register.evidence.json')
  const tracePath = join(evidenceDir, 'owner-git-import-use-evidence-register.trace.json')
  const signoffRegister = await runOwnerGitSignoffRegisterHarness({
    evidenceDir: join(evidenceDir, 'owner-git-signoff-register'),
    targetReferenceManifestPath: options.targetReferenceManifestPath,
    ownerGitReviewManifestPath: options.ownerGitReviewManifestPath,
  })
  const sourceFiles = await collectSourceFiles(process.cwd())
  const samplePaths = [...new Set(signoffRegister.entries.flatMap(entry => entry.samplePaths))]
  const sampleUsageEvidence = buildSampleUsageEvidence(process.cwd(), samplePaths, sourceFiles)
  const register = buildOwnerGitImportUseEvidenceRegister({
    signoffRegister,
    sampleUsageEvidence,
  })
  const result: OwnerGitImportUseEvidenceRegisterHarnessResult = {
    ...register,
    evidencePath,
    tracePath,
  }

  await writeJson(tracePath, {
    sourceFileCount: sourceFiles.length,
    samplePathCount: samplePaths.length,
    signoffRegister,
    sampleUsageEvidence,
    register,
  })
  await writeJson(evidencePath, result)
  return result
}
