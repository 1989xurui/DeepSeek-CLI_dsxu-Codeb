import * as React from 'react';
import { RemoteEnvironmentDialog } from '../../components/RemoteEnvironmentDialog.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
export async function call(onDone: LocalJSXCommandOnDone): Promise<React.ReactNode> {
  return <RemoteEnvironmentDialog onDone={onDone} />;
}

// V14 lifecycle shim: remote-env
export function processRemoteEnvLifecycle(input) {
  void input
  const state = 'remote-env-state'
  const lifecycle = 'remote-env:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
