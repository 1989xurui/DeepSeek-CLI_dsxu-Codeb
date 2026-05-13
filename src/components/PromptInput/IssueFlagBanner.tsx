import * as React from 'react';
import { FLAG_ICON } from '../../constants/figures.js';
import { Box, Text } from '../../ink.js';

/**
 * ANT-ONLY: Banner shown in the transcript that prompts users to report
 * issues via /issue. Appears when friction is detected in the conversation.
 */
export function IssueFlagBanner() {
  return null;
}

// V14 lifecycle shim: issueflagbanner
export function processIssueflagbannerLifecycle(input) {
  void input
  const state = 'issueflagbanner-state'
  const lifecycle = 'issueflagbanner:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
