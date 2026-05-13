export { analyzeContext, analyzeContextWeighted } from './query-context-builder-v1'
import { analyzeContextDepth as analyzeContextDepthFromDiscipline } from './context-discipline-control'
import { generateContextSuggestions as generateContextSuggestionsBuilder } from './query-context-builder-v1'

export type ContextDepthLike = {
  depthLevel: 'low' | 'medium' | 'high'
  estimatedTokens?: number
  duplicateReadSignals?: number
  totalTurns?: number
  userTurns?: number
  assistantTurns?: number
}

export interface ContextWarning {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

export interface EditContextInput {
  filePaths: string[]
  intent: 'read' | 'edit' | 'review'
}

export interface EditContext {
  targetFiles: string[]
  intent: 'read' | 'edit' | 'review'
  fileCount: number
}

export interface TeammateContextInput {
  agentId: string
  teamName: string
  planModeRequired: boolean
}

export interface TeammateContext {
  agentId: string
  teamName: string
  communicationMode: 'direct' | 'lead-mediated'
  planModeRequired: boolean
}

export interface WorkloadContextInput {
  workload: 'idle' | 'cron' | 'interactive' | 'batch'
  pendingItems: number
}

export interface WorkloadContext {
  workload: 'idle' | 'cron' | 'interactive' | 'batch'
  pendingItems: number
  riskLevel: 'low' | 'medium' | 'high'
}

export function analyzeContextDepth(input: {
  messages: Array<{ role: string; content: string }>
  duplicateReadSignals?: number
}): ContextDepthLike {
  const depth = analyzeContextDepthFromDiscipline(input as { messages: Array<{ role: string; content: string }>; duplicateReadSignals?: number })
  return {
    depthLevel: depth.depthLevel,
    estimatedTokens: depth.estimatedTokens,
    duplicateReadSignals: depth.duplicateReadSignals,
    totalTurns: depth.totalTurns,
    userTurns: depth.userTurns,
    assistantTurns: depth.assistantTurns,
  }
}

export function analyzeContextDepthMainline(input: {
  messages: Array<{ role: string; content: string }>
  duplicateReadSignals?: number
}): ContextDepthLike {
  return analyzeContextDepth(input)
}

export function generateContextSuggestions(input: ContextDepthLike): Array<{ severity: 'info' | 'warning'; title: string; detail: string }> {
  const estimated = input.estimatedTokens ?? 0
  const percentage = derivePercentage(input)
  const duplicateReadTokens = (input.duplicateReadSignals || 0) * 100
  const base = generateContextSuggestionsBuilder({
    percentage,
    duplicateReadTokens,
    autoCompactEnabled: true,
  })
  if (base.length > 0) return base

  const fallback: Array<{ severity: 'info' | 'warning'; title: string; detail: string }> = []
  if (input.depthLevel === 'high') {
    fallback.push({
      severity: 'warning',
      title: 'Context depth is high',
      detail: 'Consider compacting or splitting tasks.',
    })
  }
  return fallback
}

export function checkContextWarnings(input: { depthLevel: 'low' | 'medium' | 'high'; estimatedTokens?: number }): ContextWarning[] {
  const out: ContextWarning[] = []
  if (input.depthLevel === 'high') {
    out.push({
      severity: 'warning',
      title: 'context depth high',
      detail: `Estimated depth=${input.depthLevel}, token=${input.estimatedTokens ?? 0}`,
    })
  }
  if ((input.estimatedTokens ?? 0) > 30000) {
    out.push({
      severity: 'critical',
      title: 'context risk',
      detail: 'Estimated token usage suggests early compact risk',
    })
  }
  if (out.length === 0) {
    out.push({
      severity: 'info',
      title: 'context ok',
      detail: 'No blocking warnings.',
    })
  }
  return out
}

export function extractEditContext(input: EditContextInput): EditContext {
  const targetFiles = Array.from(new Set(input.filePaths.map((file) => file.trim()).filter(Boolean)))
  return {
    targetFiles,
    intent: input.intent,
    fileCount: targetFiles.length,
  }
}

export function buildTeammateContext(input: TeammateContextInput): TeammateContext {
  return {
    agentId: input.agentId,
    teamName: input.teamName,
    communicationMode: input.planModeRequired ? 'lead-mediated' : 'direct',
    planModeRequired: input.planModeRequired,
  }
}

export function analyzeWorkloadContext(input: WorkloadContextInput): WorkloadContext {
  const riskLevel = classifyWorkloadRisk(input.workload, input.pendingItems)
  return {
    workload: input.workload,
    pendingItems: input.pendingItems,
    riskLevel,
  }
}

export type DoctorWarning = {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

export function generateDoctorWarnings(input: {
  analysis?: {
    depthLevel?: 'low' | 'medium' | 'high'
    percentage?: number
  }
  suggestions?: Array<{ severity?: 'info' | 'warning'; title?: string; detail?: string }>
}): DoctorWarning[] {
  const out: DoctorWarning[] = []

  const percentage = input.analysis?.percentage
  const depthLevel = input.analysis?.depthLevel

  if (typeof percentage === 'number') {
    if (percentage >= 85) {
      out.push({
        severity: 'warning',
        title: 'Context token pressure high',
        detail: `Context is at ${percentage}%; compact or summarize expected`,
      })
    }
    if (percentage >= 95) {
      out.push({
        severity: 'critical',
        title: 'Context overflow risk',
        detail: 'Context budget is near collapse threshold, avoid extra prompt expansion',
      })
    }
  }

  if (depthLevel === 'high') {
    out.push({
      severity: 'warning',
      title: 'High context depth',
      detail: 'Depth classification is high, prefer concise continuation and targeted reads',
    })
  }

  if (out.length === 0) {
    const suggestionCount = input.suggestions?.filter((item) => item.severity === 'warning').length ?? 0
    if (suggestionCount > 0) {
      out.push({
        severity: 'info',
        title: 'Warnings inherited from context suggestions',
        detail: 'Actionable hints are present in suggestion output',
      })
    } else {
      out.push({
        severity: 'info',
        title: 'No doctor-level warnings',
        detail: 'Current context profile is within expected bounds',
      })
    }
  }

  return out
}

function derivePercentage(input: ContextDepthLike): number {
  if (input.estimatedTokens === undefined) {
    if (input.depthLevel === 'high') return 85
    if (input.depthLevel === 'medium') return 65
    return 35
  }
  return Math.min(100, Math.round(input.estimatedTokens / 300))
}

function classifyWorkloadRisk(
  workload: WorkloadContextInput['workload'],
  pendingItems: number,
): 'low' | 'medium' | 'high' {
  if (pendingItems >= 20) return 'high'
  if (workload === 'cron' && pendingItems >= 8) return 'medium'
  if (workload === 'batch' && pendingItems >= 12) return 'medium'
  if (pendingItems >= 4) return 'medium'
  return 'low'
}
