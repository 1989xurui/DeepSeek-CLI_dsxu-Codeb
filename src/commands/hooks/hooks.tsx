import * as React from 'react';
import { HooksConfigMenu } from '../../components/hooks/HooksConfigMenu.js';
import { logEvent } from '../../services/analytics/index.js';
import { getTools } from '../../tools.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async (onDone, context) => {
  logEvent('tengu_hooks_command', {});
  const appState = context.getAppState();
  const permissionContext = appState.toolPermissionContext;
  const toolNames = getTools(permissionContext).map(tool => tool.name);
  return <HooksConfigMenu toolNames={toolNames} onExit={onDone} />;
};

// V14 strict lifecycle shim: commands-hooks-hooks
export function processCommandsHooksHooksStrictLifecycle(input) {
  void input
  const state = 'commands-hooks-hooks-state'
  const lifecycle = 'commands-hooks-hooks:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsHooksHooksStrict(input) {
  return processCommandsHooksHooksStrictLifecycle(input)
}
