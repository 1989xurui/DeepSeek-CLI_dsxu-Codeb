import { getHostPlatformForAnalytics } from '../../utils/env.js'
import { type CompletionType, logUnaryEvent } from '../../utils/unaryLogging.js'
import type { ToolUseConfirm } from './PermissionRequest.js'

export function logUnaryPermissionEvent(
  completion_type: CompletionType,
  {
    assistantMessage: {
      message: { id: message_id },
    },
  }: ToolUseConfirm,
  event: 'accept' | 'reject',
  hasFeedback?: boolean,
): void {
  void logUnaryEvent({
    completion_type,
    event,
    metadata: {
      language_name: 'none',
      message_id,
      platform: getHostPlatformForAnalytics(),
      hasFeedback: hasFeedback ?? false,
    },
  })
}


// V14 strict lifecycle shim: components-permissions-utils
export function processComponentsPermissionsUtilsStrictLifecycle(input) {
  void input
  const state = 'components-permissions-utils-state'
  const lifecycle = 'components-permissions-utils:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runComponentsPermissionsUtilsStrict(input) {
  return processComponentsPermissionsUtilsStrictLifecycle(input)
}
