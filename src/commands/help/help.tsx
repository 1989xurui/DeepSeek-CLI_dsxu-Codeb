import * as React from 'react';
import { HelpV2 } from '../../components/HelpV2/HelpV2.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async (onDone, {
  options: {
    commands
  }
}) => {
  return <HelpV2 commands={commands} onClose={onDone} />;
};

// V14 lifecycle shim: help
export function processHelpLifecycle(input) {
  void input
  const state = 'help-state'
  const lifecycle = 'help:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
