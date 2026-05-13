import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { Settings } from '../../components/Settings/Settings.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return <Settings onClose={onDone} context={context} defaultTab="Status" />;
}

// V14 strict lifecycle shim: commands-status-status
export function processCommandsStatusStatusStrictLifecycle(input) {
  void input
  const state = 'commands-status-status-state'
  const lifecycle = 'commands-status-status:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsStatusStatusStrict(input) {
  return processCommandsStatusStatusStrictLifecycle(input)
}
