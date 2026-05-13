#!/usr/bin/env bun

import { basename, join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

const LEVEL_1_PROTECTED = [
  'package.json',
  'package-lock.json',
  'bun.lock',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.*.json',
  '.gitignore',
  '.env',
  '.env.example',
  'bin/dsxu-code',
  'src/entrypoints/dsxu-code.tsx',
]

const LEVEL_2_PROTECTED = [
  '.dsxu/settings.json',
  '.dsxu/settings.local.json',
  '.dsxu/hooks/*',
]

const FORBIDDEN_PATTERNS = [
  /^.*setup.*\.(cmd|bat|sh)$/i,
  /^quick-start.*/i,
  /^test-.*\.(js|cmd)$/i,
  /^.*-proxy-.*\.js$/i,
  /^(USAGE|INSTALL|GETTING-STARTED)\.md$/i,
  /^.*\.bat$/i,
]

const ALLOWED_PATTERNS = [
  /^src\/services\/.*/,
  /^src\/coordinator\/.*/,
  /^src\/tools\/.*/,
  /^src\/utils\/.*/,
  /^src\/.*\/__tests__\/.*/,
  /^evals\/.*/,
  /^scripts\/.*/,
  /^\.dsxu\/.*/,
  /^extensions\/vscode-dsxu\/.*/,
]

export function isProtected(
  filePath: string,
): { protected: boolean; reason: string; level: '1' | '2' | 'pattern' } {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const fileName = basename(normalizedPath)
  const dirName = normalizedPath.split('/')[0] || ''

  for (const pattern of LEVEL_1_PROTECTED) {
    if (matchesPattern(normalizedPath, pattern)) {
      return {
        protected: true,
        reason: `level-1 protected DSXU file: ${pattern}`,
        level: '1',
      }
    }
  }

  for (const pattern of LEVEL_2_PROTECTED) {
    if (matchesPattern(normalizedPath, pattern)) {
      return {
        protected: true,
        reason: `level-2 protected DSXU file: ${pattern}`,
        level: '2',
      }
    }
  }

  if (dirName === '' || dirName === '.') {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(fileName)) {
        return {
          protected: true,
          reason: `forbidden root filename pattern: ${pattern.source}`,
          level: 'pattern',
        }
      }
    }
  }

  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return { protected: false, reason: 'allowed DSXU project write path', level: '1' }
    }
  }

  return {
    protected: true,
    reason: 'path is outside the DSXU project write allowlist',
    level: '1',
  }
}

function matchesPattern(normalizedPath: string, pattern: string): boolean {
  if (!pattern.includes('*')) return normalizedPath === pattern
  const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`)
  return regex.test(normalizedPath)
}

function writeIncident(filePath: string, reason: string, level: string): void {
  const incidentsDir = '.dsxu/incidents'
  if (!existsSync(incidentsDir)) {
    mkdirSync(incidentsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const incidentFile = join(incidentsDir, `guard-${timestamp}.md`)
  const content = [
    '# DSXU Guard Intercept',
    '',
    `Time: ${new Date().toISOString()}`,
    `Path: ${filePath}`,
    `Level: ${level}`,
    `Reason: ${reason}`,
    `Env: GUARD_FILE_PATH=${process.env.GUARD_FILE_PATH ?? ''}`,
    '',
  ].join('\n')

  writeFileSync(incidentFile, content, 'utf8')
  console.error(`[DSXU guard] wrote incident: ${incidentFile}`)
}

function main(): void {
  const filePath = process.env.GUARD_FILE_PATH
  if (!filePath) {
    console.error('[DSXU guard] GUARD_FILE_PATH is required')
    process.exit(1)
  }

  const result = isProtected(filePath)
  if (result.protected) {
    console.error(`[DSXU guard] blocked: ${result.reason}`)
    writeIncident(filePath, result.reason, result.level)
    process.exit(1)
  }

  console.error(`[DSXU guard] allowed: ${result.reason}`)
}

if (require.main === module) {
  main()
}
