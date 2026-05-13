/**
 * Legacy ExperienceStore self-RAG compatibility.
 *
 * This path is not the DSXU query-loop mainline. Keep it safe if older
 * callers use it: bounded, read-only, and explicit about source truth.
 */

import type { ExperienceRecord } from './types'
import { ExperienceStore } from './store'

export async function injectExperienceContext(
  store: ExperienceStore,
  taskDescription: string,
  baseSystemPrompt: string,
  k: number = 3,
): Promise<string> {
  const records = await store.retrieve(taskDescription, k)

  if (records.length === 0) {
    return baseSystemPrompt
  }

  const context = formatExperienceContext(records)
  return `${baseSystemPrompt}\n\n${context}`
}

function formatExperienceContext(records: ExperienceRecord[]): string {
  const lines: string[] = [
    `[ExperienceStore Context - ${records.length} similar historical task(s), read-only]`,
    'Policy: use these records as hints only. Current source files, tests, and tool output always win.',
    '',
  ]

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const label = `${record.outcome}; score=${record.finalScore}`
    lines.push(`Historical task ${i + 1} (${label}):`)
    lines.push(`  - Task: ${record.taskDescription.slice(0, 200)}`)
    lines.push(`  - Prior plan: ${record.plan.slice(0, 200)}`)

    if (record.outcome === 'failure' && record.criticReason) {
      lines.push(`  - Avoid repeating: ${record.criticReason.slice(0, 200)}`)
    } else if (record.outcome === 'success') {
      lines.push(
        `  - Lesson: ${(record.criticReason || 'The prior plan completed successfully.').slice(0, 200)}`,
      )
    }
    lines.push('')
  }

  lines.push('Reread current source truth before editing. Do not claim success without current verification.')
  return lines.join('\n')
}
