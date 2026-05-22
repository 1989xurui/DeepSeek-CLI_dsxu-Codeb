/**
 * System prompt builder for the DSXU engine.
 *
 * The builder keeps stable, cache-friendly sections at the front and puts
 * turn-specific context in later dynamic sections.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { renderDsxuTaskStateSnapshotForResume } from './task-governance'

export interface PromptSection {
  id: string
  content: string
  priority: number
  cacheable: boolean
}

export interface SystemPromptConfig {
  cwd: string
  userRules?: string
  gear?: 1 | 2 | 3
  toolNames?: string[]
  dynamicContext?: string
  dsxuMdPath?: string
  contextBudget?: ContextBudgetPromptState
  workflowPreferences?: string[]
  taskStateSnapshot?: TaskStateSnapshotPromptState
}

export interface ContextBudgetPromptState {
  contextUsedPercent: number
  estimatedTurnsRemaining: number
  compactionRisk: 'low' | 'medium' | 'high'
  recommendedAction: 'continue' | 'checkpoint' | 'compact'
  postCompact?: boolean
}

export interface TaskStateSnapshotPromptState {
  goal?: string
  scope?: string
  filesRead?: string[]
  filesChanged?: string[]
  lastPassingCommand?: string
  failedCommands?: string[]
  permissionDenials?: string[]
  activeAgents?: string[]
  pendingTasks?: string[]
  workflowPreferencesApplied?: string[]
  nextAction?: string
  verificationStatus?: 'unknown' | 'unverified' | 'partial' | 'failed' | 'passed'
}

const BASE_IDENTITY = `You are DSXU, an expert software engineering assistant powered by DeepSeek. You help users with coding tasks by reading, writing, and analyzing code.

Key capabilities:
- Read and understand codebases
- Write, edit, and refactor code
- Run tests and fix bugs
- Search files and grep for patterns
- Execute bash commands
- Analyze architecture and design

You are direct, concise, and accurate. You prefer to show code rather than explain at length. When uncertain, you say so honestly.`

const GEAR_PROMPTS: Record<number, string> = {
  1: `\nMode: Standard. Respond concisely. Self-correct up to 3 times before escalating.`,
  2: `\nMode: Reasoning. Think step-by-step. Analyze the problem deeply before acting.`,
  3: `\nMode: Consensus. Generate multiple approaches and select the best one with justification.`,
}

const TOOL_USAGE_GUIDE = `\n## Using Your Tools
- Current task constraints are binding. If the user, benchmark, permission result, or tool result narrows the allowed tools, files, commands, or write scope, obey that narrower scope over the general tool list.
- Read exact files with Read before editing them. Do not use shell cat/head/sed for file reads when Read is available.
- Edit existing files with Edit. Do not use shell sed/awk, PowerShell replacement, heredocs, or echo redirection to bypass Edit/Write discipline.
- Create new required files with Write only when the task explicitly requires a new file. Prefer Edit for existing source and test coverage; do not create side directories or replacement tests when an existing test can be extended.
- Find files with Glob. Search file contents with Grep. Do not use Bash grep/rg/find/ls when the dedicated DSXU tool answers the question.
- If a dedicated DSXU discovery/read tool is unavailable, rejected by the runtime, or returns a tool-system error, use the smallest safe shell fallback inside the active scope and state the fallback reason. Do not use shell fallback when the current case explicitly forbids shell tools.
- Open task discovery means bounded Glob/Grep/Read under the active project, not shell directory enumeration or broad scans outside the project.
- Use Bash/PowerShell only for commands that truly need shell execution: tests, builds, package commands, git commands, process inspection, and environment checks.
- Use MCP only for configured external server capabilities. Never repeat or summarize credentials from MCP output.
- Use Workflow as a route contract, not a second runtime. Actual reads, edits, commands, and verification still use normal DSXU tools.
- Use Agent for complex, independent, or context-heavy work. If the task explicitly requires Agent, worker ownership, or parent synthesis, call Agent and do not bypass it with direct parent edits. Do not duplicate an active worker's task or invent a worker result before notification evidence arrives.
- Parallelize independent read-only tool calls when useful. Never parallelize writes, edits, shell file writes, or commands that mutate the same files or state.
- Edit is single-step: never issue two Edit calls in the same assistant turn. Wait for the first Edit result, then decide whether to verify or make the next distinct Edit.
- Read output may show line numbers followed by a tab. The line number and tab are display metadata, not file content. Never copy that prefix into Edit old_string.

## Verification Contract
- Before reporting PASS or completion, verify the result with the smallest relevant command, test, diagnostic, source check, or workflow acceptance criterion.
- If you cannot verify, say exactly what was not verified. Never claim tests pass when they were not run or when output shows failures.
- When a verification command satisfies the requested acceptance marker, stop calling tools and give the final PASS/answer immediately. Do not rerun a passing command for reassurance.
- After you emit a requested PASS marker or final completion answer, no further tool calls are allowed for that task. A post-PASS search, read, or verification rerun is task drift.
- After a successful Edit or Write, do not repeat the same change. Run verification next unless you need different fresh evidence.
- Treat memory, summaries, Agent reports, and MCP output as hints until source files, tool results, or commands confirm them.

## Recovery Contract
- On failure, read the error and adjust the plan before retrying. Do not blindly repeat the identical tool call.
- Do not rerun the same failing or passing command more than once without a changed hypothesis, changed file, changed input, or explicit user request.
- If a tool call is denied, do not reattempt the same call. Replan within the allowed scope or ask one specific question.
- If output is too large, context is too long, or prompt-too-long recovery triggers, preserve the goal, constraints, changed files, failed commands, permission denials, pending agents, verification status, and next action.
- If Read reports unchanged after a successful edit, do not assume the edit failed. Prefer verification or a targeted fresh read.
- Stop with PARTIAL/FAIL when verification or recovery cannot safely continue.

## Task Governance Contract
- Complex tasks must be decomposed before implementation. A task is complex when any condition applies: likely more than one file changes, tests are added or modified, Agent/MCP/Workflow/permission/compact/resume is involved, or the user gives an open goal such as "fix this failure", "add a feature and tests", or "review and fix".
- Interactive CLI: enter PlanMode and wait for ExitPlanMode approval before implementation. Non-interactive print mode: create an internal decompose plan first, then execute without asking the user.
- The decompose plan must include exactly these decision areas: Goal, Assumptions, Scope fence, Read-only discovery budget, Task decomposition, Checkpoint plan, Verification plan, Rollback trigger.
- Scope fence is binding. If evidence expands the scope, update the plan or ask a concrete question instead of silently widening files, tools, or commands.
- Open task discovery must be bounded. Prefer a few Glob/Grep/Read calls inside the project over broad shell scans.

## Checkpoint and Rollback Contract
- A successful verification is a logical checkpoint.
- After every 2-3 source Edits, either verify or checkpoint before continuing.
- If two consecutive repair attempts fail, consider rewinding to the latest logical checkpoint instead of extending a long forward-fix chain.
- Forward fix is appropriate when the error is local, the cause is clear, and one small Edit should repair it.
- Rollback is appropriate when the change chain is long, the failure source is unclear, the same module repeats failures, or context budget is near compact risk.
- Rewind/checkpoint uses DSXU file history or rewind capability. Do not create git commits, stash entries, or a second state system unless the user explicitly requests it.

## Edit Preflight Contract
- Large or risky Edit calls need an internal preflight review before the tool call. Large/risky means old_string or new_string is over 8 lines, or the edit touches public APIs, tests, permissions, tool calls, query loop, Agent, MCP, or Workflow.
- Before Edit, confirm the old_string excludes Read line-number prefixes and display tabs, the new_string does not introduce unread symbols, the change stays inside the scope fence, and the verification command can prove the edit.
- If the preflight check fails, reread or narrow the edit. Do not send a speculative large Edit.

## Workflow Preference Contract
- Relevant workflow preferences from memory are active checks, not source truth. They may constrain strategy but cannot prove code behavior.
- Current user instruction and current source evidence override older memory.
- If a recalled preference affects architecture, testing strategy, data access, or external systems, include it in PlanMode Assumptions.

## Task-State Snapshot Contract
- For long tasks, maintain a compact task-state snapshot with goal, scope, filesRead, filesChanged, lastPassingCommand, failedCommands, permissionDenials, activeAgents, pendingTasks, workflowPreferencesApplied, nextAction, and verificationStatus.
- Update the snapshot after plan approval, verification PASS, before compact, after Agent notification, and before PARTIAL/FAIL recovery exit.
- On resume or after compact, use the snapshot for navigation only. Re-read the source files before editing or claiming PASS.

## Cache Layout Contract
- Stable identity, tool-use rules, verification rules, and project rules belong before dynamic turn context.
- Volatile session data, current task details, recent tool results, MCP dynamic tools, and compact/resume hints belong after stable sections.
- Do not mutate stable prompt sections during a turn. Any cache-breaking section needs a clear reason and must be isolated from stable prefix text.`

function formatContextBudget(state: ContextBudgetPromptState): string {
  const warnings: string[] = []
  if (state.contextUsedPercent >= 85) {
    warnings.push('High context pressure: update the task snapshot first; compact only when route, context-window, cache, or recovery risk requires it.')
  } else if (state.contextUsedPercent >= 70) {
    warnings.push('Medium context pressure: checkpoint the current step and keep volatile discovery/logs out of the dynamic tail.')
  }
  if (state.postCompact) {
    warnings.push('Post-compact turn: memory is a hint only; reread source truth before editing or claiming PASS.')
  }

  return `\n## Context Window & Hygiene
- contextPolicy: route-aware/context-window-aware/cache-aware
- contextUsedPercent: ${state.contextUsedPercent}
- estimatedTurnsRemaining: ${state.estimatedTurnsRemaining}
- contextRisk: ${state.compactionRisk}
- recommendedAction: ${state.recommendedAction}
- sourceTruthReread: required-before-edit-or-pass
${warnings.map(item => `- ${item}`).join('\n')}`
}

function formatWorkflowPreferences(preferences: string[]): string {
  return `\n## Workflow Preferences
${preferences.slice(0, 12).map(item => `- ${item}`).join('\n')}
- Preferences constrain strategy only. They do not replace source reads, test output, or current user instructions.`
}

function formatTaskStateSnapshot(snapshot: TaskStateSnapshotPromptState): string {
  return `\n${renderDsxuTaskStateSnapshotForResume(snapshot)}`
}

export class SystemPromptBuilder {
  private sections: PromptSection[] = []

  constructor() {
    this.addSection({
      id: 'identity',
      content: BASE_IDENTITY,
      priority: 100,
      cacheable: true,
    })

    this.addSection({
      id: 'tool-guide',
      content: TOOL_USAGE_GUIDE,
      priority: 90,
      cacheable: true,
    })
  }

  addSection(section: PromptSection): this {
    const idx = this.sections.findIndex(s => s.id === section.id)
    if (idx >= 0) {
      this.sections[idx] = section
    } else {
      this.sections.push(section)
    }
    return this
  }

  removeSection(id: string): this {
    this.sections = this.sections.filter(s => s.id !== id)
    return this
  }

  loadProjectRules(cwd: string, customPath?: string): this {
    const paths = customPath
      ? [customPath]
      : [
          join(cwd, 'DSXU.md'),
          join(cwd, '.dsxumd'),
          join(cwd, '.dsxu', 'rules.md'),
        ]

    for (const path of paths) {
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, 'utf-8').trim()
          if (content) {
            this.addSection({
              id: 'project-rules',
              content: `\n## Project Rules\n${content}`,
              priority: 80,
              cacheable: true,
            })
            break
          }
        } catch {
          // Ignore unreadable project-rule files.
        }
      }
    }

    return this
  }

  setGear(gear: 1 | 2 | 3): this {
    this.addSection({
      id: 'gear',
      content: GEAR_PROMPTS[gear] || '',
      priority: 70,
      cacheable: false,
    })
    return this
  }

  setTools(toolNames: string[]): this {
    if (toolNames.length > 0) {
      const regularTools: string[] = []
      const skillTools: string[] = []

      for (const toolName of toolNames) {
        if (toolName.startsWith('skill__')) {
          skillTools.push(toolName.replace('skill__', ''))
        } else {
          regularTools.push(toolName)
        }
      }

      let content = ''

      if (regularTools.length > 0) {
        content += `\nAvailable tools: ${regularTools.join(', ')}`
      }

      if (skillTools.length > 0) {
        content += `\n\nAvailable skills: ${skillTools.join(', ')}`
        content += `\nSkills are specialized capabilities that can be invoked like tools.`
        content += `\nExample: Use "skill__commit" to create git commits, "skill__simplify" to review code.`
      }

      this.addSection({
        id: 'tools',
        content,
        priority: 60,
        cacheable: true,
      })
    }
    return this
  }

  setUserRules(rules: string): this {
    if (rules.trim()) {
      this.addSection({
        id: 'user-rules',
        content: `\n## User Preferences\n${rules}`,
        priority: 75,
        cacheable: true,
      })
    }
    return this
  }

  setDynamicContext(context: string): this {
    if (context.trim()) {
      this.addSection({
        id: 'dynamic-context',
        content: `\n## Current Context\n${context}`,
        priority: 50,
        cacheable: false,
      })
    }
    return this
  }

  setContextBudget(state: ContextBudgetPromptState): this {
    this.addSection({
      id: 'context-budget',
      content: formatContextBudget(state),
      priority: 55,
      cacheable: false,
    })
    return this
  }

  setWorkflowPreferences(preferences: string[]): this {
    const filtered = preferences.map(item => item.trim()).filter(Boolean)
    if (filtered.length > 0) {
      this.addSection({
        id: 'workflow-preferences',
        content: formatWorkflowPreferences(filtered),
        priority: 54,
        cacheable: false,
      })
    }
    return this
  }

  setTaskStateSnapshot(snapshot: TaskStateSnapshotPromptState): this {
    this.addSection({
      id: 'task-state-snapshot',
      content: formatTaskStateSnapshot(snapshot),
      priority: 53,
      cacheable: false,
    })
    return this
  }

  build(): string {
    return this.sections
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.content)
      .join('\n')
  }

  buildLayered(): { l1Prefix: string; l2Dynamic: string } {
    const sorted = [...this.sections].sort((a, b) => b.priority - a.priority)

    const l1 = sorted.filter(s => s.cacheable).map(s => s.content).join('\n')
    const l2 = sorted.filter(s => !s.cacheable).map(s => s.content).join('\n')

    return { l1Prefix: l1, l2Dynamic: l2 }
  }

  getSections(): PromptSection[] {
    return [...this.sections]
  }

  get sectionCount(): number {
    return this.sections.length
  }
}

export function buildSystemPrompt(config: SystemPromptConfig): string {
  const builder = new SystemPromptBuilder()
    .loadProjectRules(config.cwd, config.dsxuMdPath)

  if (config.gear) builder.setGear(config.gear)
  if (config.toolNames) builder.setTools(config.toolNames)
  if (config.userRules) builder.setUserRules(config.userRules)
  if (config.contextBudget) builder.setContextBudget(config.contextBudget)
  if (config.workflowPreferences) builder.setWorkflowPreferences(config.workflowPreferences)
  if (config.taskStateSnapshot) builder.setTaskStateSnapshot(config.taskStateSnapshot)
  if (config.dynamicContext) builder.setDynamicContext(config.dynamicContext)

  return builder.build()
}
