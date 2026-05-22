import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type FullAbsorbTarget = {
  key: string
  label: string
  path: string
  exists: boolean
  status: 'implemented' | 'partial' | 'missing'
  phase: 1 | 2
}

export type FullAbsorbStatus = {
  root: string
  total: number
  implemented: number
  ratio: number
  targets: FullAbsorbTarget[]
}

export function scanFullAbsorbStatus(root: string): FullAbsorbStatus {
  const specs = [
    ['memdir', 'Session memory directory owner', 'src/memdir', 1],
    ['file_history', 'File history evidence owner', 'src/services/file-history', 2],
    ['prompt_cache_break_detection', 'Prompt cache break detection', 'src/dsxu/engine/cache', 2],
    ['tasks', 'Task planning owner', 'src/tasks', 1],
    ['prompt_suggestion_speculation', 'Prompt suggestion speculation', 'src/dsxu/engine/prompt-suggestions', 2],
  ] as const

  const targets: FullAbsorbTarget[] = specs.map(([key, label, path, phase]) => {
    const exists = existsSync(join(root, path))
    return {
      key,
      label,
      path,
      exists,
      phase,
      status: exists ? 'implemented' : 'missing',
    }
  })
  const implemented = targets.filter((target) => target.exists).length
  return {
    root,
    total: targets.length,
    implemented,
    ratio: targets.length === 0 ? 1 : implemented / targets.length,
    targets,
  }
}

export function buildFullAbsorbActions(status: FullAbsorbStatus): Array<{
  wave: 'W1' | 'W2'
  items: string[]
}> {
  const missingPhase1 = status.targets
    .filter((target) => target.phase === 1 && target.status === 'missing')
    .map((target) => `${target.key} -> ${target.path}`)
  const missingPhase2 = status.targets
    .filter((target) => target.phase === 2 && target.status === 'missing')
    .map((target) => `${target.key} -> ${target.path}`)
  const actions: Array<{ wave: 'W1' | 'W2'; items: string[] }> = []
  if (missingPhase1.length > 0) actions.push({ wave: 'W1', items: missingPhase1 })
  if (missingPhase2.length > 0) actions.push({ wave: 'W2', items: missingPhase2 })
  if (actions.length === 0) {
    actions.push({
      wave: 'W2',
      items: ['owner review -> confirm absorbed targets remain on DSXU mainline'],
    })
  }
  return actions
}
