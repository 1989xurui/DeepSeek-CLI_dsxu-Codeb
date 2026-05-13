export type RuntimeWorkflowExecutionPolicy = {
  enforceAllowedTools: boolean
  allowedTools: string[]
  blockedTools: string[]
  policyHint: string
  workflowName?: string
}

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase()
}

function allowedToolMatches(
  requestedToolName: string,
  allowedToolName: string,
): boolean {
  const requested = normalizeToolName(requestedToolName)
  const allowed = normalizeToolName(allowedToolName)
  if (!allowed) return false
  if (requested === allowed) return true

  if (allowed === 'mcp') return requested.startsWith('mcp__')
  if (allowed === 'agent' || allowed === 'task') {
    return requested === 'agent' || requested === 'task'
  }
  if (allowed === 'workflow') return requested === 'workflow'

  return false
}

export function isToolAllowedByWorkflowPolicy(
  toolName: string,
  policy: RuntimeWorkflowExecutionPolicy | undefined,
): boolean {
  if (!policy?.enforceAllowedTools) return true
  return policy.allowedTools.some(allowed =>
    allowedToolMatches(toolName, allowed),
  )
}

export function buildWorkflowPolicyDenialMessage(
  toolName: string,
  policy: RuntimeWorkflowExecutionPolicy,
): string {
  const workflow = policy.workflowName ? ` for workflow ${policy.workflowName}` : ''
  const allowed = policy.allowedTools.length
    ? policy.allowedTools.join(', ')
    : '(none)'
  return [
    `Workflow execution policy blocked tool ${toolName}${workflow}.`,
    `Allowed tools: ${allowed}.`,
    policy.policyHint,
  ]
    .filter(Boolean)
    .join(' ')
}
