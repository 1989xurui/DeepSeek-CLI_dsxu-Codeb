import type {
  DSXUActionContractRisk,
  DSXUExecutionTaskType,
} from './action-contract'

export type DSXUV8ToolWindowProfile =
  | 'explain'
  | 'search'
  | 'single_file_edit'
  | 'normal_coding'
  | 'debug'
  | 'review'
  | 'multi_file_refactor'
  | 'long_task'
  | 'benchmark'
  | 'provider_security_release'
  | 'pro_expert'

export type DSXUV8ToolWindowPolicy = {
  schemaVersion: 'dsxu.tool-window-policy.v8'
  profile: DSXUV8ToolWindowProfile
  minVisibleTools: number
  defaultVisibleTools: number
  maxVisibleTools: number
  owner: 'Tool Gate'
  evidence: readonly string[]
}

export type DSXUV8ToolWindowCountDecision = {
  valid: boolean
  guards: readonly string[]
  evidence: readonly string[]
}

const V8_TOOL_WINDOW_POLICIES: Record<
  DSXUV8ToolWindowProfile,
  Omit<DSXUV8ToolWindowPolicy, 'schemaVersion' | 'profile' | 'owner' | 'evidence'>
> = {
  explain: { minVisibleTools: 0, defaultVisibleTools: 4, maxVisibleTools: 8 },
  search: { minVisibleTools: 4, defaultVisibleTools: 8, maxVisibleTools: 12 },
  single_file_edit: { minVisibleTools: 8, defaultVisibleTools: 12, maxVisibleTools: 16 },
  normal_coding: { minVisibleTools: 12, defaultVisibleTools: 16, maxVisibleTools: 20 },
  debug: { minVisibleTools: 12, defaultVisibleTools: 16, maxVisibleTools: 24 },
  review: { minVisibleTools: 8, defaultVisibleTools: 12, maxVisibleTools: 16 },
  multi_file_refactor: { minVisibleTools: 16, defaultVisibleTools: 20, maxVisibleTools: 24 },
  long_task: { minVisibleTools: 16, defaultVisibleTools: 24, maxVisibleTools: 27 },
  benchmark: { minVisibleTools: 16, defaultVisibleTools: 20, maxVisibleTools: 24 },
  provider_security_release: { minVisibleTools: 18, defaultVisibleTools: 22, maxVisibleTools: 27 },
  pro_expert: { minVisibleTools: 20, defaultVisibleTools: 24, maxVisibleTools: 27 },
}

const V8_LOGICAL_TOOL_ORDER: Record<DSXUV8ToolWindowProfile, readonly string[]> = {
  explain: ['Read', 'Grep', 'Glob', 'LSP', 'GitDiff', 'Evidence', 'Todo', 'ToolSearch'],
  search: ['Grep', 'Glob', 'Read', 'LSP', 'GitDiff', 'Evidence', 'Todo', 'ToolSearch', 'Bash', 'PowerShell', 'Replay', 'Agent'],
  single_file_edit: ['Read', 'Edit', 'Write', 'Bash', 'PowerShell', 'Grep', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Todo', 'Replay', 'ToolSearch', 'Agent', 'FileHistory'],
  normal_coding: ['Read', 'Edit', 'Write', 'Bash', 'PowerShell', 'Grep', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Todo', 'Replay', 'ToolSearch', 'Agent', 'FileHistory', 'TaskOutput', 'NotebookEdit', 'CollectEvidence', 'AskUser'],
  debug: ['Read', 'Grep', 'Bash', 'PowerShell', 'Edit', 'Write', 'Glob', 'LSP', 'GitDiff', 'RunNativeTest', 'Evidence', 'Replay', 'Todo', 'ToolSearch', 'FileHistory', 'TaskOutput', 'Agent', 'CollectEvidence', 'AskUser', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'TerminalCapture'],
  review: ['Read', 'Grep', 'Glob', 'GitDiff', 'Bash', 'PowerShell', 'Evidence', 'Replay', 'LSP', 'RunNativeTest', 'Todo', 'CollectEvidence', 'ToolSearch', 'Agent', 'MCPDocs', 'SkillRunner'],
  multi_file_refactor: ['Read', 'Grep', 'Glob', 'LSP', 'Edit', 'Write', 'Bash', 'PowerShell', 'GitDiff', 'RunNativeTest', 'Todo', 'Evidence', 'Replay', 'ToolSearch', 'Agent', 'TaskOutput', 'FileHistory', 'CollectEvidence', 'AskUser', 'NotebookEdit', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch'],
  long_task: ['Read', 'Grep', 'Glob', 'LSP', 'Todo', 'Agent', 'TaskOutput', 'Bash', 'PowerShell', 'Edit', 'Write', 'GitDiff', 'RunNativeTest', 'Evidence', 'Replay', 'CollectEvidence', 'ToolSearch', 'FileHistory', 'AskUser', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'NotebookEdit', 'TerminalCapture', 'TaskCreate', 'TaskUpdate'],
  benchmark: ['Bash', 'PowerShell', 'Replay', 'Evidence', 'CollectEvidence', 'Read', 'Grep', 'Glob', 'GitDiff', 'RunNativeTest', 'Todo', 'ToolSearch', 'Agent', 'TaskOutput', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'TerminalCapture', 'AskUser', 'FileHistory', 'Edit', 'Write', 'LSP'],
  provider_security_release: ['Read', 'Grep', 'Glob', 'GitDiff', 'Bash', 'PowerShell', 'RunNativeTest', 'Evidence', 'CollectEvidence', 'Replay', 'Todo', 'ToolSearch', 'Agent', 'TaskOutput', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'FileHistory', 'AskUser', 'LSP', 'Edit', 'Write', 'TerminalCapture', 'TaskCreate', 'TaskUpdate', 'NotebookEdit'],
  pro_expert: ['Read', 'Grep', 'Glob', 'LSP', 'GitDiff', 'Bash', 'PowerShell', 'RunNativeTest', 'Evidence', 'CollectEvidence', 'Replay', 'Todo', 'Agent', 'TaskOutput', 'ToolSearch', 'MCPDocs', 'SkillRunner', 'WebSearch', 'WebFetch', 'FileHistory', 'AskUser', 'Edit', 'Write', 'NotebookEdit', 'TerminalCapture', 'TaskCreate', 'TaskUpdate'],
}

export function resolveDSXUV8ToolWindowProfile(input: {
  taskType: DSXUExecutionTaskType
  risk?: DSXUActionContractRisk
  modelRoute?: 'flash' | 'flash_thinking' | 'flash_max' | 'pro'
  publicClaimIntent?: boolean
  benchmarkIntent?: boolean
}): DSXUV8ToolWindowProfile {
  if (
    input.publicClaimIntent ||
    input.risk === 'critical' ||
    input.taskType === 'benchmark' && input.benchmarkIntent
  ) {
    return 'provider_security_release'
  }
  if (input.modelRoute === 'pro') return 'pro_expert'
  switch (input.taskType) {
    case 'explain':
      return 'explain'
    case 'search':
      return 'search'
    case 'single_file_edit':
      return 'single_file_edit'
    case 'debug':
      return 'debug'
    case 'review':
      return 'review'
    case 'multi_file_refactor':
      return 'multi_file_refactor'
    case 'long_task':
      return 'long_task'
    case 'benchmark':
      return 'benchmark'
  }
}

export function getDSXUV8ToolWindowPolicy(
  profile: DSXUV8ToolWindowProfile,
): DSXUV8ToolWindowPolicy {
  const policy = V8_TOOL_WINDOW_POLICIES[profile]
  return {
    schemaVersion: 'dsxu.tool-window-policy.v8',
    profile,
    ...policy,
    owner: 'Tool Gate',
    evidence: [
      `profile:${profile}`,
      `min:${policy.minVisibleTools}`,
      `default:${policy.defaultVisibleTools}`,
      `max:${policy.maxVisibleTools}`,
    ],
  }
}

export function resolveDSXUV8ToolWindowPolicy(input: {
  taskType: DSXUExecutionTaskType
  risk?: DSXUActionContractRisk
  modelRoute?: 'flash' | 'flash_thinking' | 'flash_max' | 'pro'
  publicClaimIntent?: boolean
  benchmarkIntent?: boolean
}): DSXUV8ToolWindowPolicy {
  return getDSXUV8ToolWindowPolicy(resolveDSXUV8ToolWindowProfile(input))
}

export function buildDSXUV8LogicalToolWindow(input: {
  taskType: DSXUExecutionTaskType
  risk?: DSXUActionContractRisk
  modelRoute?: 'flash' | 'flash_thinking' | 'flash_max' | 'pro'
  publicClaimIntent?: boolean
  benchmarkIntent?: boolean
  maxVisibleTools?: number
}): readonly string[] {
  const policy = resolveDSXUV8ToolWindowPolicy(input)
  const target = Math.max(
    policy.minVisibleTools,
    Math.min(input.maxVisibleTools ?? policy.defaultVisibleTools, policy.maxVisibleTools),
  )
  return V8_LOGICAL_TOOL_ORDER[policy.profile].slice(0, target)
}

export function evaluateDSXUV8ToolWindowCount(input: {
  visibleToolCount: number
  policy: DSXUV8ToolWindowPolicy
  actualToolPoolCount?: number
}): DSXUV8ToolWindowCountDecision {
  const guards: string[] = []
  if (input.visibleToolCount > input.policy.maxVisibleTools) {
    guards.push(`visible tool view exceeds V8 ${input.policy.profile} max of ${input.policy.maxVisibleTools}`)
  }
  if (
    input.actualToolPoolCount !== undefined &&
    input.actualToolPoolCount >= input.policy.minVisibleTools &&
    input.visibleToolCount < input.policy.minVisibleTools
  ) {
    guards.push(`visible tool view is below V8 ${input.policy.profile} minimum of ${input.policy.minVisibleTools}`)
  }
  return {
    valid: guards.length === 0,
    guards,
    evidence: [
      `policy:${input.policy.profile}`,
      `visibleToolCount:${input.visibleToolCount}`,
      `min:${input.policy.minVisibleTools}`,
      `default:${input.policy.defaultVisibleTools}`,
      `max:${input.policy.maxVisibleTools}`,
      input.actualToolPoolCount === undefined ? '' : `actualToolPoolCount:${input.actualToolPoolCount}`,
    ].filter(Boolean),
  }
}
