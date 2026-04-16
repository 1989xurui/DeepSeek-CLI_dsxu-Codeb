import { existsSync } from 'fs'
import { join } from 'path'
import type { FullAbsorbAction, FullAbsorbStatus, FullAbsorbTargetStatus } from './types'

const TARGETS: Array<Pick<FullAbsorbTargetStatus, 'phase' | 'key' | 'path'>> = [
  { phase: 'Phase0', key: 'engine_tests', path: 'src/dsxu/engine/__tests__' },
  { phase: 'Phase0', key: 'single_entry_engine', path: 'src/dsxu/engine/index.ts' },

  { phase: 'Phase1', key: 'extract_memories', path: 'src/services/extractMemories' },
  { phase: 'Phase1', key: 'session_memory', path: 'src/services/SessionMemory' },
  { phase: 'Phase1', key: 'auto_dream', path: 'src/services/autoDream' },
  { phase: 'Phase1', key: 'magic_docs', path: 'src/services/MagicDocs' },
  { phase: 'Phase1', key: 'memdir', path: 'src/memdir' },
  { phase: 'Phase1', key: 'compact', path: 'src/services/compact' },
  { phase: 'Phase1', key: 'file_history', path: 'src/utils/fileHistory.ts' },
  { phase: 'Phase1', key: 'prompt_cache_break_detection', path: 'src/services/api/promptCacheBreakDetection.ts' },
  { phase: 'Phase1', key: 'cost_tracker', path: 'src/cost-tracker.ts' },
  { phase: 'Phase1', key: 'token_budget', path: 'src/query/tokenBudget.ts' },
  { phase: 'Phase1', key: 'token_estimation', path: 'src/services/tokenEstimation.ts' },
  { phase: 'Phase1', key: 'permissions', path: 'src/utils/permissions' },

  { phase: 'Phase2', key: 'mcp', path: 'src/services/mcp' },
  { phase: 'Phase2', key: 'lsp', path: 'src/services/lsp' },
  { phase: 'Phase2', key: 'tasks', path: 'src/tasks' },
  { phase: 'Phase2', key: 'task_utils', path: 'src/utils/task' },
  { phase: 'Phase2', key: 'swarm_utils', path: 'src/utils/swarm' },
  { phase: 'Phase2', key: 'hooks', path: 'src/utils/hooks' },
  { phase: 'Phase2', key: 'analytics', path: 'src/services/analytics' },
  { phase: 'Phase2', key: 'settings_sync', path: 'src/services/settingsSync' },
  { phase: 'Phase2', key: 'plugins', path: 'src/services/plugins' },

  { phase: 'Phase3', key: 'forked_agent', path: 'src/dsxu/engine/forked-agent.ts' },
  { phase: 'Phase3', key: 'agent_summary', path: 'src/services/AgentSummary' },
  { phase: 'Phase3', key: 'agent_tool', path: 'src/tools/AgentTool' },
  { phase: 'Phase3', key: 'coordinator', path: 'src/coordinator' },
  { phase: 'Phase3', key: 'skills', path: 'src/skills' },
  { phase: 'Phase3', key: 'prompt_suggestion_speculation', path: 'src/services/PromptSuggestion/speculation.ts' },

  { phase: 'Phase4', key: 'tool_ecosystem', path: 'src/tools' },
  { phase: 'Phase4', key: 'tool_shared', path: 'src/tools/shared' },

  { phase: 'Phase5', key: 'transaction_manager', path: 'src/dsxu/engine/transaction-manager.ts' },
  { phase: 'Phase5', key: 'circuit_breaker', path: 'src/dsxu/engine/circuit-breaker.ts' },
  { phase: 'Phase5', key: 'reviewer_subagent', path: 'src/dsxu/engine/reviewer-subagent.ts' },
  { phase: 'Phase5', key: 'worktree_orchestrator', path: 'src/dsxu/engine/worktree-orchestrator.ts' },
  { phase: 'Phase5', key: 'evo_engine', path: 'src/dsxu/engine/evo-engine.ts' },
]

export function scanFullAbsorbStatus(cwd: string): FullAbsorbStatus {
  const targets: FullAbsorbTargetStatus[] = TARGETS.map(t => {
    const abs = join(cwd, t.path)
    const exists = existsSync(abs)
    return {
      ...t,
      exists,
      status: exists ? 'complete' : 'missing',
    }
  })

  const complete = targets.filter(t => t.status === 'complete').length
  const partial = targets.filter(t => t.status === 'partial').length
  const missing = targets.filter(t => t.status === 'missing').length
  const total = targets.length
  const ratio = total === 0 ? 1 : complete / total

  return { total, complete, partial, missing, ratio, targets }
}

export function buildFullAbsorbActions(status: FullAbsorbStatus): FullAbsorbAction[] {
  const remaining = status.targets.filter(t => t.status !== 'complete')
  if (remaining.length === 0) {
    return [
      {
        wave: 'W1',
        title: 'Full Absorb Completed',
        items: ['All tracked targets are present in repository.'],
      },
    ]
  }

  const byPhase = new Map<string, string[]>()
  for (const t of remaining) {
    const list = byPhase.get(t.phase) ?? []
    list.push(`${t.key} -> ${t.path}`)
    byPhase.set(t.phase, list)
  }

  const wave1: string[] = []
  const wave2: string[] = []
  for (const phase of ['Phase1', 'Phase2', 'Phase3', 'Phase4', 'Phase5']) {
    const items = byPhase.get(phase)
    if (!items || items.length === 0) continue
    if (phase === 'Phase1' || phase === 'Phase2') wave1.push(...items)
    else wave2.push(...items)
  }

  return [
    { wave: 'W1', title: 'Infrastructure + Engineering Completion', items: wave1 },
    { wave: 'W2', title: 'Agent + Tooling + Industrial Completion', items: wave2 },
  ]
}
