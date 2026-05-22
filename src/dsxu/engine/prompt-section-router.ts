import type { DSXUExecutionTaskType } from './action-contract'
import {
  buildDSXUCapabilityRegistry,
  compileDSXUCapabilityActivationPlan,
  type DSXUCapabilityRegistry,
} from './capability-registry'
import type { DSXUToolViewCompilerResult } from './tool-catalog-v1'

export type DSXUPromptSectionPlacement = 'stable_core' | 'dynamic_task_tail'

export type DSXUPromptSectionId =
  | 'identity'
  | 'task_contract'
  | 'tool_view'
  | 'verification_claim_gate'
  | 'recovery_short'
  | 'agent_serial_worker'
  | 'agent_parallel_fanout'
  | 'skill_match'
  | 'mcp_context'

export type DSXUPromptSectionDecision = {
  id: DSXUPromptSectionId
  placement: DSXUPromptSectionPlacement
  included: boolean
  reason: string
  text: string
  charCount: number
}

export type DSXUPromptSectionPlan = {
  schemaVersion: 'dsxu.prompt-section-plan.v6s'
  owner: 'Prompt runtime'
  taskType: DSXUExecutionTaskType
  sections: readonly DSXUPromptSectionDecision[]
  includedSectionIds: readonly DSXUPromptSectionId[]
  omittedSectionIds: readonly DSXUPromptSectionId[]
  promptText: string
  promptChars: number
  stablePrefixChars: number
  dynamicTailChars: number
  forbiddenLongSectionsPresent: readonly string[]
  cacheBoundary: {
    stablePrefixLocked: boolean
    dynamicTailContainsTaskOnly: boolean
  }
  guards: readonly string[]
}

export type DSXUPromptSectionPlanInput = {
  taskType: DSXUExecutionTaskType
  toolView: Pick<DSXUToolViewCompilerResult, 'visibleToolIds' | 'hiddenToolIds' | 'profile'>
  registry?: DSXUCapabilityRegistry
  taskContractAllows?: readonly string[]
  matchedSkillIds?: readonly string[]
  mcpResourceRefs?: readonly string[]
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  goal?: string
  currentEvidence?: readonly string[]
  verificationLevel?: string
  stopCondition?: string
}

const FORBIDDEN_LONG_SECTION_MARKERS = [
  'SwarmCoordinator',
  'TeamCreate',
  'SkillRunner',
  'MCPDocs',
]

function section(
  id: DSXUPromptSectionId,
  placement: DSXUPromptSectionPlacement,
  included: boolean,
  reason: string,
  text: string,
): DSXUPromptSectionDecision {
  return {
    id,
    placement,
    included,
    reason,
    text: included ? text : '',
    charCount: included ? text.length : 0,
  }
}

export function buildDSXUPromptSectionPlan(
  input: DSXUPromptSectionPlanInput,
): DSXUPromptSectionPlan {
  const registry = input.registry ?? buildDSXUCapabilityRegistry()
  const activation = compileDSXUCapabilityActivationPlan({
    taskType: input.taskType,
    registry,
    taskContractAllows: input.taskContractAllows,
    matchedSkillIds: input.matchedSkillIds,
    mcpResourceRefs: input.mcpResourceRefs,
  })
  const active = new Set(activation.activeCapabilityIds)
  const includeAgent = active.has('agent.serial-worker') || active.has('agent.parallel-fanout')
  const includeSkill = active.has('skills.searchable')
  const includeMcp = active.has('mcp.expert')
  const includeRecovery = input.riskLevel === 'high' || input.riskLevel === 'critical' || input.taskType === 'debug'
  const visibleTools = input.toolView.visibleToolIds.join(', ')
  const standbyTools = input.toolView.hiddenToolIds.length > 0
    ? `${input.toolView.hiddenToolIds.length} hidden tools via ToolSearch/contract`
    : 'none'
  const goal = (input.goal ?? 'current user request').trim().slice(0, 220)
  const evidence = (input.currentEvidence ?? []).slice(0, 4).join('; ') || 'none yet'
  const verificationLevel = input.verificationLevel ?? 'task-appropriate'
  const stopCondition = input.stopCondition ?? 'stop only after verified PASS, honest PARTIAL, or explicit blocker'

  const sections: DSXUPromptSectionDecision[] = [
    section(
      'identity',
      'stable_core',
      true,
      'stable DSXU identity and anti-false-claim discipline',
      'DSXU Code: DeepSeek-first local engineering runtime. Never claim PASS without verification evidence.',
    ),
    section(
      'task_contract',
      'dynamic_task_tail',
      true,
      'task-specific contract belongs in the dynamic tail',
      `Goal: ${goal}. Task profile: ${input.taskType}. Risk: ${input.riskLevel ?? 'medium'}. Evidence: ${evidence}.`,
    ),
    section(
      'tool_view',
      'dynamic_task_tail',
      true,
      'only current visible tools are exposed to DeepSeek',
      `Active tools: ${visibleTools}. Standby expansion: ${standbyTools}; activate only through task contract.`,
    ),
    section(
      'verification_claim_gate',
      'dynamic_task_tail',
      true,
      'claim gate is always needed but short',
      `Required verification: ${verificationLevel}. Stop condition: ${stopCondition}. If verification is not run, final claim is PARTIAL/not-run.`,
    ),
    section(
      'recovery_short',
      'dynamic_task_tail',
      includeRecovery,
      includeRecovery ? 'debug/high-risk task needs short recovery decision rules' : 'ordinary task does not need long recovery tutorial',
      'On repeated failure: classify, retry once, replan, rollback or ask user. Do not loop silently.',
    ),
    section(
      'agent_serial_worker',
      'dynamic_task_tail',
      includeAgent,
      includeAgent ? 'Agent sidecar explicitly activated by task contract' : 'Agent sidecar hidden for ordinary task',
      'Agent mode: serial worker. Worker returns evidence envelope only; parent owns synthesis.',
    ),
    section(
      'agent_parallel_fanout',
      'dynamic_task_tail',
      includeAgent && input.taskType !== 'single_file_edit',
      includeAgent ? 'parallel fanout allowed only for independent scoped work' : 'parallel fanout hidden for ordinary task',
      'Agent mode: parallel fanout for independent read-only or disjoint-scope work; no swarm/team mesh.',
    ),
    section(
      'skill_match',
      'dynamic_task_tail',
      includeSkill,
      includeSkill ? 'matched skill evidence activates the searchable skill layer' : 'skill list omitted by default',
      `Matched skills: ${(input.matchedSkillIds ?? []).join(', ')}. Skill output is evidence, not final PASS.`,
    ),
    section(
      'mcp_context',
      'dynamic_task_tail',
      includeMcp,
      includeMcp ? 'explicit MCP resource reference activates expert MCP context' : 'MCP instructions omitted by default',
      `MCP resources: ${(input.mcpResourceRefs ?? []).join(', ')}. MCP results must flow through Tool Gate and verification.`,
    ),
  ]

  const promptText = sections.filter(item => item.included).map(item => item.text).join('\n')
  const stablePrefixChars = sections
    .filter(item => item.included && item.placement === 'stable_core')
    .reduce((sum, item) => sum + item.charCount, 0)
  const dynamicTailChars = sections
    .filter(item => item.included && item.placement === 'dynamic_task_tail')
    .reduce((sum, item) => sum + item.charCount, 0)
  const forbiddenLongSectionsPresent = FORBIDDEN_LONG_SECTION_MARKERS.filter(marker =>
    promptText.includes(marker),
  )
  const guards = [
    forbiddenLongSectionsPresent.length > 0
      ? `forbidden long sections present:${forbiddenLongSectionsPresent.join('|')}`
      : '',
    input.taskType === 'single_file_edit' && (includeAgent || includeSkill || includeMcp)
      ? 'single_file_edit activated expert/agent sections'
      : '',
  ].filter(Boolean)

  return {
    schemaVersion: 'dsxu.prompt-section-plan.v6s',
    owner: 'Prompt runtime',
    taskType: input.taskType,
    sections,
    includedSectionIds: sections.filter(item => item.included).map(item => item.id),
    omittedSectionIds: sections.filter(item => !item.included).map(item => item.id),
    promptText,
    promptChars: promptText.length,
    stablePrefixChars,
    dynamicTailChars,
    forbiddenLongSectionsPresent,
    cacheBoundary: {
      stablePrefixLocked: true,
      dynamicTailContainsTaskOnly: true,
    },
    guards,
  }
}
