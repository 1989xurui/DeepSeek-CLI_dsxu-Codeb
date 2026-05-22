import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import {
  collectDSXUBrandCompatOccurrences,
  type DSXUBrandCompatRiskBoard,
} from '../src/dsxu/engine/brand-compat-risk-board'

const ROOT = process.cwd()
const OUTPUT_JSON = join(ROOT, 'docs', 'generated', 'DSXU_BRAND_COMPAT_RISK_BOARD_20260517.json')
const OUTPUT_MD = join(ROOT, 'docs', 'DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md')

async function main(): Promise<void> {
  const files = await collectFiles(ROOT, ['src', 'scripts', 'docs', 'package.json'])
  const board = collectDSXUBrandCompatOccurrences({
    files,
    generatedAt: '2026-05-17T00:00:00.000Z',
  })
  await mkdir(join(ROOT, 'docs', 'generated'), { recursive: true })
  await writeFile(OUTPUT_JSON, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD, renderMarkdown(board), 'utf8')
  console.log('PASS_DSXU_BRAND_COMPAT_RISK_BOARD_GENERATED')
  console.log(`status=${board.status}`)
  console.log(`scannedFileCount=${board.scannedFileCount}`)
  console.log(`occurrenceCount=${board.occurrenceCount}`)
  console.log(`publicSurfaceBlockerCount=${board.publicSurfaceBlockerCount}`)
  console.log(`runtimeCleanupCandidateCount=${board.runtimeCleanupCandidateCount}`)
}

async function collectFiles(root: string, entries: readonly string[]): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = []
  for (const entry of entries) {
    const absolute = join(root, entry)
    const fileStat = await stat(absolute).catch(() => undefined)
    if (!fileStat) continue
    if (fileStat.isFile()) {
      files.push({ path: entry, content: await readFile(absolute, 'utf8') })
      continue
    }
    for (const file of await walk(absolute)) {
      const path = relative(root, file).replace(/\\/g, '/')
      if (!isTextLike(path)) continue
      try {
        files.push({ path, content: await readFile(file, 'utf8') })
      } catch {
        // Binary or unreadable generated files are not part of this text risk board.
      }
    }
  }
  return files
}

async function walk(dir: string): Promise<string[]> {
  const results: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.dsxu') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await walk(full)))
    } else {
      results.push(full)
    }
  }
  return results
}

function isTextLike(path: string): boolean {
  return /\.(cjs|css|js|json|jsonc|jsx|lock|md|mjs|ps1|sh|ts|tsx|txt|yaml|yml)$/i.test(path)
}

function renderMarkdown(board: DSXUBrandCompatRiskBoard): string {
  const byDisposition = board.occurrences.reduce<Record<string, number>>((acc, occurrence) => {
    acc[occurrence.disposition] = (acc[occurrence.disposition] ?? 0) + 1
    return acc
  }, {})
  const rows = Object.entries(byDisposition)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([disposition, count]) => `| ${disposition} | ${count} |`)
    .join('\n')
  const topOccurrences = board.occurrences
    .filter(occurrence =>
      occurrence.disposition === 'public-surface-blocker' ||
      occurrence.disposition === 'runtime-cleanup-candidate' ||
      occurrence.disposition === 'build-time-dce-review'
    )
    .slice(0, 80)
    .map(occurrence =>
      `| ${occurrence.disposition} | ${occurrence.kind} | ${occurrence.path}:${occurrence.line} | ${occurrence.match} | ${occurrence.reason} |`
    )
    .join('\n')

  return [
    '# DSXU Brand and Compatibility Risk Board',
    '',
    `Generated at: ${board.generatedAt}`,
    '',
    'This board classifies legacy provider, reference-brand, and compatibility call-sites. It does not delete or rewrite files. Product release can use it to decide what stays as DSXU-owned compatibility evidence and what needs owner cleanup.',
    '',
    '## Summary',
    '',
    `- Status: ${board.status}`,
    `- Scanned files: ${board.scannedFileCount}`,
    `- Occurrences: ${board.occurrenceCount}`,
    `- Public surface blockers: ${board.publicSurfaceBlockerCount}`,
    `- Runtime cleanup candidates: ${board.runtimeCleanupCandidateCount}`,
    `- Build-time DCE review: ${board.buildTimeDceReviewCount}`,
    '',
    '## Disposition Counts',
    '',
    '| Disposition | Count |',
    '|---|---:|',
    rows || '| none | 0 |',
    '',
    '## Review Queue',
    '',
    '| Disposition | Kind | Location | Match | Reason |',
    '|---|---|---|---|---|',
    topOccurrences || '| none | none | none | none | none |',
    '',
    '## Safeguards',
    '',
    ...board.safeguards.map(safeguard => `- ${safeguard}`),
    '',
  ].join('\n')
}

await main()
