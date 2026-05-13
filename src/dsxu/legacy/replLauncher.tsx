// DSXU V15 ownership marker: upstream-derived capability is absorbed into DSXU mainline; no upstream vendor runtime dependency.
import React from 'react';
import type { StatsStore } from '../../context/stats.js';
import type { Root } from '../../ink.js';
import type { Props as REPLProps } from '../../screens/REPL.js';
import type { AppState } from '../../state/AppStateStore.js';
import type { FpsMetrics } from '../../utils/fpsTracker.js';
type AppWrapperProps = {
  getFpsMetrics: () => FpsMetrics | undefined;
  stats?: StatsStore;
  initialState: AppState;
};
export async function launchRepl(root: Root, appProps: AppWrapperProps, replProps: REPLProps, renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>): Promise<void> {
  const {
    App
  } = await import('../../components/App.js');
  const {
    REPL
  } = await import('../../screens/REPL.js');
  await renderAndRun(root, <App {...appProps}>
      <REPL {...replProps} />
    </App>);
}

export function getDsxuLegacyReplLauncherRuntimeProfile() {
  return {
    runtime: 'DSXU Legacy REPL Launcher Boundary',
    defaultBehavior: 'old replLauncher has been moved under src/dsxu/legacy and is not the default DSXU Code entrypoint',
    providerTarget: 'DSXU Code CLI Entrypoint',
    activationEvidence: [
      'root src/replLauncher.tsx is absent',
      'legacy launcher remains available only for migration/reference',
      'DSXU Code default entrypoint owns model/tool/prompt strategy',
    ],
  }
}
