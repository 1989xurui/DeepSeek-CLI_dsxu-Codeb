import React, { useCallback, useEffect, useRef } from 'react';
import { isBridgeEnabled } from '../dsxu/engine/provider-backend/dsxu-provider-compat.js';
import { getCompatProviderTokens } from '../dsxu/legacy/auth/legacyProviderControlAuth.js';
import { Box, Text } from '../ink.js';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js';
import type { OptionWithDescription } from './CustomSelect/select.js';
import { Select } from './CustomSelect/select.js';
import { PermissionDialog } from './permissions/PermissionDialog.js';
type RemoteCalloutSelection = 'enable' | 'dismiss';
type Props = {
  onDone: (selection: RemoteCalloutSelection) => void;
};
export function RemoteCallout({
  onDone
}: Props): React.ReactNode {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const handleCancel = useCallback((): void => {
    onDoneRef.current('dismiss');
  }, []);

  // Permanently mark as seen on mount so it only shows once
  useEffect(() => {
    saveGlobalConfig(current => {
      if (current.remoteDialogSeen) return current;
      return {
        ...current,
        remoteDialogSeen: true
      };
    });
  }, []);
  const handleSelect = useCallback((value: RemoteCalloutSelection): void => {
    onDoneRef.current(value);
  }, []);
  const options: OptionWithDescription<RemoteCalloutSelection>[] = [{
    label: 'Enable Remote Control for this session',
    description: 'Opens a secure connection to the DSXU remote workspace provider.',
    value: 'enable'
  }, {
    label: 'Never mind',
    description: 'You can always enable it later with /remote-control.',
    value: 'dismiss'
  }];
  return <PermissionDialog title="Remote Control">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box marginBottom={1} flexDirection="column">
          <Text>
            Remote Control lets you access this CLI session from the web
            (DSXU remote workspace), so you can pick up where you
            left off on any device.
          </Text>
          <Text> </Text>
          <Text>
            You can disconnect remote access anytime by running /remote-control
            again.
          </Text>
        </Box>
        <Box>
          <Select options={options} onChange={handleSelect} onCancel={handleCancel} />
        </Box>
      </Box>
    </PermissionDialog>;
}

/**
 * Check whether to show the remote callout (first-time dialog).
 */
export function shouldShowRemoteCallout(): boolean {
  const config = getGlobalConfig();
  if (config.remoteDialogSeen) return false;
  if (!isBridgeEnabled()) return false;
  const tokens = getCompatProviderTokens();
  if (!tokens?.accessToken) return false;
  return true;
}
export function getDsxuRemoteCalloutRuntimeProfile() {
  return {
    runtime: 'DSXU Remote Callout Boundary',
    defaultBehavior: 'callout only appears when DSXU remote provider gate enables remote control',
    providerTarget: 'DSXU Remote Session Provider',
    activationEvidence: [
      'shouldShowRemoteCallout is suppressed when bridgeEnabled is false in DSXU mode',
      'user-facing copy points to DSXU remote workspace onboarding',
      'remote enable/dismiss UX is retained for DSXU provider onboarding',
    ],
  }
}

// V14 lifecycle shim: remotecallout
export function processRemotecalloutLifecycle(input) {
  void input
  const state = 'remotecallout-state'
  const lifecycle = 'remotecallout:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
