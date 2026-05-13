import * as React from 'react';
import { PermissionRuleList } from '../../components/permissions/rules/PermissionRuleList.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { createPermissionRetryMessage } from '../../utils/messages.js';
export const call: LocalJSXCommandCall = async (onDone, context) => {
  return <PermissionRuleList onExit={onDone} onRetryDenials={commands => {
    context.setMessages(prev => [...prev, createPermissionRetryMessage(commands)]);
  }} />;
};

// V14 strict lifecycle shim: commands-permissions-permissions
export function processCommandsPermissionsPermissionsStrictLifecycle(input) {
  void input
  const state = 'commands-permissions-permissions-state'
  const lifecycle = 'commands-permissions-permissions:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsPermissionsPermissionsStrict(input) {
  return processCommandsPermissionsPermissionsStrictLifecycle(input)
}
