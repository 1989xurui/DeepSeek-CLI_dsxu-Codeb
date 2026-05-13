import type {
  DsxuControlPermissionRequest,
  DsxuControlSessionRegistry,
} from './controlSession.js'
import { ingestDsxuControlMessage } from './controlMessaging.js'

export type DsxuInboundControlMessage =
  | {
      type: 'control_request'
      request_id: string
      request: {
        subtype: 'can_use_tool'
        tool_use_id?: string
        tool_name: string
        input: Record<string, unknown>
      }
    }
  | {
      type: 'control_response'
      request_id: string
      response:
        | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
        | { behavior: 'deny'; message?: string }
    }
  | {
      type: 'control_cancel_request'
      request_id: string
    }

export type DsxuInboundControlResult =
  | { type: 'permission_request'; request: DsxuControlPermissionRequest }
  | { type: 'permission_response'; request: DsxuControlPermissionRequest | undefined }
  | { type: 'permission_cancelled'; request: DsxuControlPermissionRequest | undefined }
  | { type: 'error'; code: 'malformed_message' | 'unsupported_message'; message: string }
  | { type: 'ignored' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function malformed(message: string): DsxuInboundControlResult {
  return { type: 'error', code: 'malformed_message', message }
}

function unsupported(type: string): DsxuInboundControlResult {
  return {
    type: 'error',
    code: 'unsupported_message',
    message: `Unsupported DSXU control message type: ${type}`,
  }
}

export function handleDsxuUnknownInboundControlMessage(
  registry: DsxuControlSessionRegistry,
  sessionId: string,
  rawMessage: unknown,
): DsxuInboundControlResult {
  if (!isRecord(rawMessage)) {
    ingestDsxuControlMessage(registry, {
      sessionId,
      type: 'control_error',
      payload: { reason: 'malformed_message' },
      summary: 'Malformed DSXU control message: expected object',
    })
    return malformed('Malformed DSXU control message: expected object')
  }

  const rawType = rawMessage.type
  if (typeof rawType !== 'string' || rawType.length === 0) {
    ingestDsxuControlMessage(registry, {
      sessionId,
      type: 'control_error',
      payload: rawMessage,
      summary: 'Malformed DSXU control message: missing type',
    })
    return malformed('Malformed DSXU control message: missing type')
  }

  if (rawType === 'control_request') {
    const request = rawMessage.request
    if (
      typeof rawMessage.request_id !== 'string' ||
      !isRecord(request) ||
      request.subtype !== 'can_use_tool' ||
      typeof request.tool_name !== 'string' ||
      !isRecord(request.input)
    ) {
      ingestDsxuControlMessage(registry, {
        sessionId,
        type: 'control_error',
        payload: rawMessage,
        summary: 'Malformed DSXU control request',
      })
      return malformed('Malformed DSXU control request')
    }
    return handleDsxuInboundControlMessage(registry, sessionId, {
      type: 'control_request',
      request_id: rawMessage.request_id,
      request: {
        subtype: 'can_use_tool',
        tool_use_id:
          typeof request.tool_use_id === 'string'
            ? request.tool_use_id
            : undefined,
        tool_name: request.tool_name,
        input: request.input,
      },
    })
  }

  if (rawType === 'control_response') {
    const response = rawMessage.response
    if (
      typeof rawMessage.request_id !== 'string' ||
      !isRecord(response) ||
      (response.behavior !== 'allow' && response.behavior !== 'deny')
    ) {
      ingestDsxuControlMessage(registry, {
        sessionId,
        type: 'control_error',
        payload: rawMessage,
        summary: 'Malformed DSXU control response',
      })
      return malformed('Malformed DSXU control response')
    }
    return handleDsxuInboundControlMessage(registry, sessionId, {
      type: 'control_response',
      request_id: rawMessage.request_id,
      response:
        response.behavior === 'allow'
          ? {
              behavior: 'allow',
              updatedInput: isRecord(response.updatedInput)
                ? response.updatedInput
                : undefined,
            }
          : {
              behavior: 'deny',
              message:
                typeof response.message === 'string'
                  ? response.message
                  : undefined,
            },
    })
  }

  if (rawType === 'control_cancel_request') {
    if (typeof rawMessage.request_id !== 'string') {
      ingestDsxuControlMessage(registry, {
        sessionId,
        type: 'control_error',
        payload: rawMessage,
        summary: 'Malformed DSXU control cancel request',
      })
      return malformed('Malformed DSXU control cancel request')
    }
    return handleDsxuInboundControlMessage(registry, sessionId, {
      type: 'control_cancel_request',
      request_id: rawMessage.request_id,
    })
  }

  ingestDsxuControlMessage(registry, {
    sessionId,
    type: 'control_error',
    payload: rawMessage,
    summary: `Unsupported DSXU control message type: ${rawType}`,
  })
  return unsupported(rawType)
}

export function handleDsxuInboundControlMessage(
  registry: DsxuControlSessionRegistry,
  sessionId: string,
  message: DsxuInboundControlMessage,
): DsxuInboundControlResult {
  ingestDsxuControlMessage(registry, {
    sessionId,
    type: message.type,
    payload: message,
  })

  if (message.type === 'control_request' && message.request.subtype === 'can_use_tool') {
    const request = registry.recordPermissionRequest({
      sessionId,
      requestId: message.request_id,
      toolUseId: message.request.tool_use_id,
      toolName: message.request.tool_name,
      input: message.request.input,
    })
    return { type: 'permission_request', request }
  }

  if (message.type === 'control_response') {
    const request = registry.recordPermissionResponse({
      sessionId,
      requestId: message.request_id,
      response:
        message.response.behavior === 'allow'
          ? {
              behavior: 'allow',
              updatedInput: message.response.updatedInput ?? {},
            }
          : {
              behavior: 'deny',
              message: message.response.message ?? 'denied by DSXU control plane',
            },
    })
    return { type: 'permission_response', request }
  }

  if (message.type === 'control_cancel_request') {
    const request = registry.cancelPermissionRequest(sessionId, message.request_id)
    return { type: 'permission_cancelled', request }
  }

  return { type: 'ignored' }
}
