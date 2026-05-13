import React from 'react';
import { jsonParse } from '../../utils/slowOperations.js';
import type { Output } from './TeamDeleteTool.js';
export function renderToolUseMessage(_input: Record<string, unknown>): React.ReactNode {
  return 'cleanup team: current';
}
export function renderToolResultMessage(content: Output | string, _progressMessages: unknown, {
  verbose: _verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  const result: Output = typeof content === 'string' ? jsonParse(content) : content;

  // Suppress cleanup result - the batched shutdown message covers this
  if ('success' in result && 'team_name' in result && 'message' in result) {
    return null;
  }
  return null;
}

// V14 strict lifecycle shim: tools-TeamDeleteTool-UI
export function processToolsTeamDeleteToolUIStrictLifecycle(input) {
  void input
  const state = 'tools-TeamDeleteTool-UI-state'
  const lifecycle = 'tools-TeamDeleteTool-UI:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsTeamDeleteToolUIStrict(input) {
  return processToolsTeamDeleteToolUIStrictLifecycle(input)
}
