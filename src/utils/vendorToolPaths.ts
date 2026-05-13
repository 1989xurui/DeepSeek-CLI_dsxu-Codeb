import { existsSync } from 'fs'
import { homedir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function ripgrepPlatformKey(): string {
  return process.platform === 'win32' ? 'win32' : process.platform
}

function ripgrepExecutableName(): string {
  return process.platform === 'win32' ? 'rg.exe' : 'rg'
}

export function getVendoredRipgrepBinDir(): string | null {
  const wslCacheDir = resolve(
    homedir(),
    '.dsxu',
    'tools',
    'ripgrep',
    `${process.arch}-${ripgrepPlatformKey()}`,
  )
  const wslCacheExecutable = resolve(wslCacheDir, ripgrepExecutableName())
  if (process.platform === 'linux' && existsSync(wslCacheExecutable)) {
    return wslCacheDir
  }

  const dir = resolve(
    __dirname,
    'vendor',
    'ripgrep',
    `${process.arch}-${ripgrepPlatformKey()}`,
  )
  const executable = resolve(dir, ripgrepExecutableName())
  return existsSync(executable) ? dir : null
}

export function getVendoredToolPathEntries(): string[] {
  const entries: string[] = []
  const ripgrepBinDir = getVendoredRipgrepBinDir()
  if (ripgrepBinDir) entries.push(ripgrepBinDir)
  return entries
}
