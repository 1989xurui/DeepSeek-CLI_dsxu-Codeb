import type {
  DsxuControlPermissionRequest,
  DsxuControlPermissionResponse,
  DsxuControlSessionRegistry,
} from './controlSession.js'

export type DsxuVisiblePermissionPrompt = {
  requestId: string
  sessionId: string
  toolName: string
  summary: string
  hiddenWaiting: false
}

export function createDsxuVisiblePermissionPrompt(input: {
  sessionId: string
  request: DsxuControlPermissionRequest
}): DsxuVisiblePermissionPrompt {
  return {
    requestId: input.request.requestId,
    sessionId: input.sessionId,
    toolName: input.request.toolName,
    summary: `Permission requested for ${input.request.toolName}; requestId=${input.request.requestId}`,
    hiddenWaiting: false,
  }
}

export function recordDsxuPermissionControlResponse(
  registry: DsxuControlSessionRegistry,
  input: {
    sessionId: string
    requestId: string
    response: Omit<DsxuControlPermissionResponse, 'answeredAt'>
  },
): DsxuControlPermissionRequest | undefined {
  return registry.recordPermissionResponse({
    sessionId: input.sessionId,
    requestId: input.requestId,
    response: input.response,
  })
}
