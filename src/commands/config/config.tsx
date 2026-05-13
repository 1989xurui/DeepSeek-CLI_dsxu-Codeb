import * as React from 'react';
import { Settings } from '../../components/Settings/Settings.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async (onDone, context) => {
  return <Settings onClose={onDone} context={context} defaultTab="Config" />;
};

// V14 strict lifecycle shim: commands-config-config
export function processCommandsConfigConfigStrictLifecycle(input) {
  void input
  const state = 'commands-config-config-state'
  const lifecycle = 'commands-config-config:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsConfigConfigStrict(input) {
  return processCommandsConfigConfigStrictLifecycle(input)
}
