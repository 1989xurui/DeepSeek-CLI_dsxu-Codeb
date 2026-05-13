import * as React from 'react';
import { Stats } from '../../components/Stats.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
export const call: LocalJSXCommandCall = async onDone => {
  return <Stats onClose={onDone} />;
};

// V14 strict lifecycle shim: commands-stats-stats
export function processCommandsStatsStatsStrictLifecycle(input) {
  void input
  const state = 'commands-stats-stats-state'
  const lifecycle = 'commands-stats-stats:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsStatsStatsStrict(input) {
  return processCommandsStatsStatsStrictLifecycle(input)
}
