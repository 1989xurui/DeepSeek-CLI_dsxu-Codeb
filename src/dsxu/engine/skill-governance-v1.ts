import type { SkillDefinition, SkillGovernancePolicy, SkillTag } from './skills-types-v1'

export type SkillGovernanceStatus = 'ready' | 'blocked'

export type SkillGovernanceViolation =
  | 'missing_use_when'
  | 'missing_do_not_use_when'
  | 'missing_required_tools'
  | 'missing_exit_criteria'
  | 'missing_evidence_fields'
  | 'missing_context_owner_rule'
  | 'missing_tool_evidence_pack'
  | 'code_edit_without_read_tool'
  | 'code_edit_without_edit_tool'
  | 'test_without_command_tool'
  | 'tool_not_allowed_by_skill'

export interface SkillToolBoundary {
  allowedTools: string[]
  forbiddenTools: string[]
  requiresToolEvidencePack: true
  requiresContextOwnerRule: true
}

export interface SkillGovernanceContract {
  schemaVersion: 'dsxu.skill-governance.v1'
  skillId: string
  skillTags: SkillTag[]
  useWhen: string[]
  doNotUseWhen: string[]
  requiredTools: string[]
  forbiddenTools: string[]
  exitCriteria: string[]
  evidenceFields: string[]
  toolBoundary: SkillToolBoundary
  status: SkillGovernanceStatus
  violations: SkillGovernanceViolation[]
  trace: string[]
}

export interface SkillGovernanceValidation {
  valid: boolean
  violations: SkillGovernanceViolation[]
  missingFields: string[]
}

export interface SkillToolUseEvaluation {
  allowed: boolean
  reason: string
  violation?: SkillGovernanceViolation
}

const COMMON_EVIDENCE_FIELDS = [
  'selectionTrace',
  'contextOwnerRule',
  'toolEvidencePack',
  'sourceTruthFiles',
  'verificationOutput',
]

const COMMON_DO_NOT_USE_WHEN = [
  'current source truth is unavailable',
  'tool permission or gate state blocks required tools',
  'the task can be completed by direct answer without skill invocation',
]

export function buildSkillGovernanceContract(skill: SkillDefinition): SkillGovernanceContract {
  const defaults = defaultGovernancePolicyForSkill(skill)
  const policy = mergeGovernancePolicy(defaults, skill.governance)
  const contract: SkillGovernanceContract = {
    schemaVersion: 'dsxu.skill-governance.v1',
    skillId: skill.skillId,
    skillTags: [...skill.metadata.tags],
    useWhen: unique(policy.useWhen),
    doNotUseWhen: unique(policy.doNotUseWhen),
    requiredTools: unique(policy.requiredTools),
    forbiddenTools: unique(policy.forbiddenTools),
    exitCriteria: unique(policy.exitCriteria),
    evidenceFields: unique(policy.evidenceFields),
    toolBoundary: {
      allowedTools: unique(policy.requiredTools),
      forbiddenTools: unique(policy.forbiddenTools),
      requiresToolEvidencePack: true,
      requiresContextOwnerRule: true,
    },
    status: 'ready',
    violations: [],
    trace: [
      `skillId=${skill.skillId}`,
      `tags=${skill.metadata.tags.join(',') || 'none'}`,
      `requiredTools=${policy.requiredTools.join(',') || 'none'}`,
      `exitCriteria=${policy.exitCriteria.length}`,
      `evidenceFields=${policy.evidenceFields.join(',') || 'none'}`,
    ],
  }
  const validation = validateSkillGovernanceContract(contract)
  return {
    ...contract,
    status: validation.valid ? 'ready' : 'blocked',
    violations: validation.violations,
  }
}

export function buildSkillGovernanceContracts(skills: readonly SkillDefinition[]): SkillGovernanceContract[] {
  return skills.map(skill => buildSkillGovernanceContract(skill))
}

export function validateSkillGovernanceContract(contract: SkillGovernanceContract): SkillGovernanceValidation {
  const missingFields: string[] = []
  const violations: SkillGovernanceViolation[] = []

  if (contract.schemaVersion !== 'dsxu.skill-governance.v1') missingFields.push('schemaVersion')
  if (!contract.skillId) missingFields.push('skillId')
  if (!Array.isArray(contract.useWhen) || contract.useWhen.length === 0) violations.push('missing_use_when')
  if (!Array.isArray(contract.doNotUseWhen) || contract.doNotUseWhen.length === 0) violations.push('missing_do_not_use_when')
  if (!Array.isArray(contract.requiredTools) || contract.requiredTools.length === 0) violations.push('missing_required_tools')
  if (!Array.isArray(contract.exitCriteria) || contract.exitCriteria.length === 0) violations.push('missing_exit_criteria')
  if (!Array.isArray(contract.evidenceFields) || contract.evidenceFields.length === 0) violations.push('missing_evidence_fields')
  if (!contract.evidenceFields.includes('contextOwnerRule')) violations.push('missing_context_owner_rule')
  if (!contract.evidenceFields.includes('toolEvidencePack')) violations.push('missing_tool_evidence_pack')

  const tags = contract.skillTags.map(tag => String(tag).toLowerCase())
  if (tags.includes('code-edit') && !contract.requiredTools.includes('Read')) {
    violations.push('code_edit_without_read_tool')
  }
  if (tags.includes('code-edit') && !contract.requiredTools.some(tool => tool === 'Edit' || tool === 'Write')) {
    violations.push('code_edit_without_edit_tool')
  }
  if (tags.includes('test') && !contract.requiredTools.some(tool => tool === 'Bash' || tool === 'PowerShell')) {
    violations.push('test_without_command_tool')
  }

  return {
    valid: missingFields.length === 0 && violations.length === 0,
    violations: unique(violations),
    missingFields,
  }
}

export function evaluateSkillToolUse(
  contract: SkillGovernanceContract,
  input: { toolId: string },
): SkillToolUseEvaluation {
  if (contract.forbiddenTools.includes(input.toolId)) {
    return {
      allowed: false,
      reason: `tool is forbidden by skill governance: ${input.toolId}`,
      violation: 'tool_not_allowed_by_skill',
    }
  }
  if (!contract.toolBoundary.allowedTools.includes(input.toolId)) {
    return {
      allowed: false,
      reason: `tool is outside skill governance boundary: ${input.toolId}`,
      violation: 'tool_not_allowed_by_skill',
    }
  }
  return { allowed: true, reason: `tool allowed by skill governance: ${input.toolId}` }
}

export function projectSkillGovernanceForAudit(contract: SkillGovernanceContract) {
  return {
    skillId: contract.skillId,
    status: contract.status,
    requiredTools: contract.requiredTools,
    exitCriteria: contract.exitCriteria,
    evidenceFields: contract.evidenceFields,
    violations: contract.violations,
  }
}

function defaultGovernancePolicyForSkill(skill: SkillDefinition): SkillGovernancePolicy {
  const tags = skill.metadata.tags.map(tag => String(tag).toLowerCase())
  const triggerText = skill.triggers.map(trigger => trigger.expression).filter(Boolean).join(', ')
  const useWhen = [
    triggerText ? `task matches trigger: ${triggerText}` : `task matches ${skill.metadata.name}`,
    `requested capability includes ${skill.metadata.tags.join(', ') || 'skill-specific work'}`,
  ]
  const requiredTools = requiredToolsForTags(tags)
  const exitCriteria = exitCriteriaForTags(tags)
  return {
    useWhen,
    doNotUseWhen: COMMON_DO_NOT_USE_WHEN,
    requiredTools,
    forbiddenTools: ['RemoteTriggerTool', 'CronCreateTool', 'CronDeleteTool'],
    exitCriteria,
    evidenceFields: COMMON_EVIDENCE_FIELDS,
  }
}

function requiredToolsForTags(tags: readonly string[]): string[] {
  const tools = new Set<string>()
  if (tags.includes('analysis')) {
    tools.add('Read')
    tools.add('Grep')
    tools.add('Glob')
    tools.add('LSP')
  }
  if (tags.includes('code-edit')) {
    tools.add('Read')
    tools.add('Edit')
    tools.add('Write')
    tools.add('Bash')
    tools.add('PowerShell')
    tools.add('LSP')
  }
  if (tags.includes('test')) {
    tools.add('Read')
    tools.add('Bash')
    tools.add('PowerShell')
  }
  if (tags.includes('recovery')) {
    tools.add('Read')
    tools.add('Grep')
    tools.add('Bash')
    tools.add('PowerShell')
  }
  if (tools.size === 0) {
    tools.add('Read')
    tools.add('Grep')
  }
  return [...tools]
}

function exitCriteriaForTags(tags: readonly string[]): string[] {
  const criteria = [
    'selection reason is recorded',
    'context owner rule is satisfied',
    'tool evidence pack is produced for required tool use',
  ]
  if (tags.includes('code-edit')) {
    criteria.push('source file was read before edit')
    criteria.push('latest verification output is recorded after edit')
  }
  if (tags.includes('test')) {
    criteria.push('test command and output are recorded')
  }
  if (tags.includes('analysis')) {
    criteria.push('analysis cites current source truth or tool evidence')
  }
  if (tags.includes('recovery')) {
    criteria.push('failure class and next recovery action are recorded')
  }
  return criteria
}

function mergeGovernancePolicy(
  defaults: SkillGovernancePolicy,
  override?: SkillGovernancePolicy,
): SkillGovernancePolicy {
  if (!override) return defaults
  return {
    useWhen: unique([...defaults.useWhen, ...override.useWhen]),
    doNotUseWhen: unique([...defaults.doNotUseWhen, ...override.doNotUseWhen]),
    requiredTools: unique([...defaults.requiredTools, ...override.requiredTools]),
    forbiddenTools: unique([...defaults.forbiddenTools, ...override.forbiddenTools]),
    exitCriteria: unique([...defaults.exitCriteria, ...override.exitCriteria]),
    evidenceFields: unique([...defaults.evidenceFields, ...override.evidenceFields]),
  }
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items.filter(Boolean))]
}
