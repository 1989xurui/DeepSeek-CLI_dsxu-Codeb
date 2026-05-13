import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import { BackgroundTasksDialog } from '../../components/tasks/BackgroundTasksDialog.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
export async function call(onDone: LocalJSXCommandOnDone, context: LocalJSXCommandContext): Promise<React.ReactNode> {
  return <BackgroundTasksDialog toolUseContext={context} onDone={onDone} />;
}

// V14 strict lifecycle shim: commands-tasks-tasks
export function processCommandsTasksTasksStrictLifecycle(input) {
  void input
  const state = 'commands-tasks-tasks-state'
  const lifecycle = 'commands-tasks-tasks:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsTasksTasksStrict(input) {
  return processCommandsTasksTasksStrictLifecycle(input)
}
