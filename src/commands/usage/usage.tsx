import * as React from 'react';
import { Settings } from '../../components/Settings/Settings.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async (onDone, context) => {
  return <Settings onClose={onDone} context={context} defaultTab="Usage" />;
};

// V14 strict lifecycle shim: commands-usage-usage
export function processCommandsUsageUsageStrictLifecycle(input) {
  void input
  const state = 'commands-usage-usage-state'
  const lifecycle = 'commands-usage-usage:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsUsageUsageStrict(input) {
  return processCommandsUsageUsageStrictLifecycle(input)
}
