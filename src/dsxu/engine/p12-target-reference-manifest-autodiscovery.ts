import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

export const DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH = 'docs/generated/DSXU_V20_P12_TARGET_MANIFEST_DISCOVERY_20260515.json'

export type P12TargetReferenceManifestAutoDiscoveryResult = {
  path?: string
  discoveryPath: string
  reason: string
}

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return null
    throw error
  }
}

export async function autoDiscoverP12TargetReferenceManifest(options: {
  root?: string
  discoveryPath?: string
} = {}): Promise<P12TargetReferenceManifestAutoDiscoveryResult> {
  const root = resolve(options.root ?? process.cwd())
  const discoveryPath = resolve(root, options.discoveryPath ?? DEFAULT_P12_TARGET_DISCOVERY_RELATIVE_PATH)
  const discovery = await readJsonIfExists(discoveryPath)
  if (!discovery) {
    return {
      discoveryPath,
      reason: 'discovery-report-missing',
    }
  }
  if (discovery.status !== 'READY_TARGET_REFERENCE_MANIFEST_DISCOVERED') {
    return {
      discoveryPath,
      reason: `discovery-not-ready:${String(discovery.status ?? 'unknown')}`,
    }
  }
  if (typeof discovery.canonicalTargetReferenceManifestPath !== 'string') {
    return {
      discoveryPath,
      reason: 'canonical-path-missing',
    }
  }
  const absolute = resolve(root, discovery.canonicalTargetReferenceManifestPath)
  if (!existsSync(absolute)) {
    return {
      discoveryPath,
      reason: `canonical-path-missing-on-disk:${absolute}`,
    }
  }
  return {
    path: absolute,
    discoveryPath,
    reason: 'ready-discovery-canonical-manifest',
  }
}
