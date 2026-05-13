import * as React from 'react';
import { AgentsMenu } from '../../components/agents/AgentsMenu.js';
import type { ToolUseContext } from '../../Tool.js';
import { getTools } from '../../tools.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
export async function call(onDone: LocalJSXCommandOnDone, context: ToolUseContext): Promise<React.ReactNode> {
  const appState = context.getAppState();
  const permissionContext = appState.toolPermissionContext;
  const tools = getTools(permissionContext);
  return <AgentsMenu tools={tools} onExit={onDone} />;
}

// V14 strict lifecycle shim: commands-agents-agents
export function processCommandsAgentsAgentsStrictLifecycle(input) {
  void input
  const state = 'commands-agents-agents-state'
  const lifecycle = 'commands-agents-agents:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsAgentsAgentsStrict(input) {
  return processCommandsAgentsAgentsStrictLifecycle(input)
}
