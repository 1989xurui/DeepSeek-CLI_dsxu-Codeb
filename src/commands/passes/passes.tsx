import * as React from 'react';
import { Passes } from '../../components/Passes/Passes.js';
import { logEvent } from '../../services/analytics/index.js';
import { getCachedRemainingPasses } from '../../services/api/referral.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
export async function call(onDone: LocalJSXCommandOnDone): Promise<React.ReactNode> {
  // Mark that user has visited /passes so we stop showing the upsell
  const config = getGlobalConfig();
  const isFirstVisit = !config.hasVisitedPasses;
  if (isFirstVisit) {
    const remaining = getCachedRemainingPasses();
    saveGlobalConfig(current => ({
      ...current,
      hasVisitedPasses: true,
      passesLastSeenRemaining: remaining ?? current.passesLastSeenRemaining
    }));
  }
  logEvent('tengu_guest_passes_visited', {
    is_first_visit: isFirstVisit
  });
  return <Passes onDone={onDone} />;
}

// V14 strict lifecycle shim: commands-passes-passes
export function processCommandsPassesPassesStrictLifecycle(input) {
  void input
  const state = 'commands-passes-passes-state'
  const lifecycle = 'commands-passes-passes:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsPassesPassesStrict(input) {
  return processCommandsPassesPassesStrictLifecycle(input)
}
