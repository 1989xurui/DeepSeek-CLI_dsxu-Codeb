import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  autoDiscoverP12TargetReferenceManifest,
  DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH,
} from '../p12-target-reference-manifest-autodiscovery'

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

describe('P12 target reference manifest auto-discovery', () => {
  test('returns the canonical manifest only when discovery is READY and the file exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-p12-auto-ready-'))
    const manifestPath = join(root, '.dsxu', 'trace', 'p12-target-reference-codex-runner-v1', 'target-reference-manifest.json')
    await writeJson(manifestPath, { schemaVersion: 'test.manifest' })
    await writeJson(join(root, DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH), {
      status: 'READY_TARGET_REFERENCE_MANIFEST_DISCOVERED',
      canonicalTargetReferenceManifestPath: manifestPath,
    })

    const result = await autoDiscoverP12TargetReferenceManifest({ root })

    expect(result).toMatchObject({
      path: manifestPath,
      reason: 'ready-discovery-canonical-manifest',
    })
  })

  test('does not fabricate or guess a manifest when discovery is missing or not ready', async () => {
    const missingRoot = await mkdtemp(join(tmpdir(), 'dsxu-p12-auto-missing-'))
    const missing = await autoDiscoverP12TargetReferenceManifest({ root: missingRoot })
    expect(missing.path).toBeUndefined()
    expect(missing.reason).toBe('discovery-report-missing')

    const blockedRoot = await mkdtemp(join(tmpdir(), 'dsxu-p12-auto-blocked-'))
    await writeJson(join(blockedRoot, DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH), {
      status: 'BLOCKED_NO_VALID_TARGET_REFERENCE_MANIFEST',
      canonicalTargetReferenceManifestPath: join(blockedRoot, 'missing.json'),
    })
    const blocked = await autoDiscoverP12TargetReferenceManifest({ root: blockedRoot })
    expect(blocked.path).toBeUndefined()
    expect(blocked.reason).toBe('discovery-not-ready:BLOCKED_NO_VALID_TARGET_REFERENCE_MANIFEST')
  })

  test('rejects stale READY discovery reports whose canonical file no longer exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-p12-auto-stale-'))
    const staleManifestPath = join(root, '.dsxu', 'trace', 'missing-target-reference-manifest.json')
    await writeJson(join(root, DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH), {
      status: 'READY_TARGET_REFERENCE_MANIFEST_DISCOVERED',
      canonicalTargetReferenceManifestPath: staleManifestPath,
    })

    const result = await autoDiscoverP12TargetReferenceManifest({ root })

    expect(result.path).toBeUndefined()
    expect(result.reason).toBe(`canonical-path-missing-on-disk:${staleManifestPath}`)
  })
})
