export const AGENT_TOOL_NAME = 'Agent'
// Legacy wire name for backward compat (permission rules, hooks, resumed sessions)
export const LEGACY_AGENT_TOOL_NAME = 'Task'
export const VERIFICATION_AGENT_TYPE = 'verification'

// Built-in agents that run once and return a report — the parent never
// SendMessages back to continue them. Skip the agentId/SendMessage/usage
// trailer for these to save tokens (~135 chars × 34M Explore runs/week).
export const ONE_SHOT_BUILTIN_AGENT_TYPES: ReadonlySet<string> = new Set([
  'Explore',
  'Plan',
])


// V14 strict lifecycle shim: tools-AgentTool-constants
export function processToolsAgentToolConstantsStrictLifecycle(input) {
  void input
  const state = 'tools-AgentTool-constants-state'
  const lifecycle = 'tools-AgentTool-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsAgentToolConstantsStrict(input) {
  return processToolsAgentToolConstantsStrictLifecycle(input)
}
