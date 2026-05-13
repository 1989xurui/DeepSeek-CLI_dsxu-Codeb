import { execa } from 'execa'
import { getMacOsKeychainStorageServiceName } from 'src/utils/secureStorage/macOsKeychainHelpers.js'

export async function maybeRemoveApiKeyFromMacOSKeychainThrows(): Promise<void> {
  if (process.platform === 'darwin') {
    const storageServiceName = getMacOsKeychainStorageServiceName()
    const result = await execa(
      `security delete-generic-password -a $USER -s "${storageServiceName}"`,
      { shell: true, reject: false },
    )
    if (result.exitCode !== 0) {
      throw new Error('Failed to delete keychain entry')
    }
  }
}

export function normalizeApiKeyForConfig(apiKey: string): string {
  return apiKey.slice(-20)
}

export function isPlaceholderApiKey(apiKey: string | undefined | null): boolean {
  if (!apiKey) {
    return true
  }
  const normalized = apiKey.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  return (
    normalized === 'your_key_here' ||
    normalized === 'your-key-here' ||
    normalized === 'change_me' ||
    normalized === 'changeme' ||
    normalized === 'placeholder' ||
    normalized.includes('...placeholder') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized === 'sk-dsxu-local' ||
    normalized === 'sk-dsxu-local-proxy' ||
    normalized === 'dsxu-token-placeholder' ||
    (normalized.startsWith('dsxu-token-') && normalized.includes('placeholder'))
  )
}

export function getUsableApiKey(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  return candidates.find(candidate => !isPlaceholderApiKey(candidate))
}
