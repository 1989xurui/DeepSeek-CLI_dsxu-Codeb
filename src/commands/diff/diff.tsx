import * as React from 'react';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async (onDone, context) => {
  const {
    DiffDialog
  } = await import('../../components/diff/DiffDialog.js');
  return <DiffDialog messages={context.messages} onDone={onDone} />;
};

// V14 strict lifecycle shim: commands-diff-diff
export function processCommandsDiffDiffStrictLifecycle(input) {
  void input
  const state = 'commands-diff-diff-state'
  const lifecycle = 'commands-diff-diff:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsDiffDiffStrict(input) {
  return processCommandsDiffDiffStrictLifecycle(input)
}
