import type { SDKMessage } from '../../entrypoints/agentSdkTypes.js'
import type {
  SDKControlCancelRequest,
  SDKControlPermissionRequest,
  SDKControlRequest,
  SDKControlResponse,
} from '../../entrypoints/sdk/controlTypes.js'
import { getSessionId } from '../../bootstrap/state.js'
import { logForDebugging } from '../../utils/debug.js'
import { logError } from '../../utils/log.js'
import type { RemoteMessageContent } from '../../utils/teleport/api.js'
import {
  getDefaultDsxuLocalProviderBackend,
  type DSXULocalProviderBackend,
} from './dsxuLocalProviderBackend.js'
import {
  getDefaultDsxuControlSessionRegistry,
  type DsxuControlSessionRegistry,
} from '../../dsxu/control-plane/controlSession.js'

export type RemotePermissionResponse =
  | {
      behavior: 'allow'
      updatedInput: Record<string, unknown>
    }
  | {
      behavior: 'deny'
      message: string
    }

export type RemoteSessionConfig = {
  sessionId: string
  getAccessToken: () => string
  orgUuid: string
  hasInitialPrompt?: boolean
  viewerOnly?: boolean
  controlRegistry?: DsxuControlSessionRegistry
}

export type RemoteSessionCallbacks = {
  onMessage: (message: SDKMessage) => void
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  onPermissionCancelled?: (
    requestId: string,
    toolUseId: string | undefined,
  ) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onReconnecting?: () => void
  onError?: (error: Error) => void
}

export function getDsxuRemoteSessionCoordinatorRuntimeProfile(): {
  runtime: 'DSXU Remote Session Coordinator'
  owner: 'DSXU Control Plane Adapter Boundary'
  activationEvidence: readonly string[]
  releaseRiskControls: readonly string[]
} {
  return {
    runtime: 'DSXU Remote Session Coordinator',
    owner: 'DSXU Control Plane Adapter Boundary',
    activationEvidence: [
      'remote sessions are recorded in the DSXU control session registry',
      'messages are projected to SDKMessage user/system events before entering the main loop',
      'permission requests are tracked by request id and answered through control responses',
      'createRemoteSession is delegated to DSXU provider backend instead of local hidden execution',
    ],
    releaseRiskControls: [
      'remote session coordinator is an adapter around the control plane',
      'remote permission responses do not bypass local Tool Gate semantics',
      'remote reconnect/cancel/disconnect state is visible through callbacks and registry state',
    ],
  }
}

function remoteContentToSummary(content: RemoteMessageContent): string {
  if (typeof content === 'string') return content
  return content
    .map(block => {
      if (typeof block.text === 'string') return block.text
      if (typeof block.content === 'string') return block.content
      return `[${block.type}]`
    })
    .join(' ')
    .trim()
}

function createEchoUserMessage(
  sessionId: string,
  content: RemoteMessageContent,
  uuid?: string,
): SDKMessage {
  return {
    type: 'user',
    uuid,
    parent_tool_use_id: null,
    session_id: sessionId,
    message: {
      role: 'user',
      content,
    },
  } as unknown as SDKMessage
}

function createSystemStatusMessage(
  subtype: string,
  extra: Record<string, unknown>,
): SDKMessage {
  return {
    type: 'system',
    subtype,
    ...extra,
  } as unknown as SDKMessage
}

export class DsxuRemoteSessionCoordinator {
  private connected = false
  private pendingPermissionRequests: Map<string, SDKControlPermissionRequest> =
    new Map()

  constructor(
    private readonly config: RemoteSessionConfig,
    private readonly callbacks: RemoteSessionCallbacks,
    private readonly backend: DSXULocalProviderBackend =
      getDefaultDsxuLocalProviderBackend(),
  ) {}

  private get controlRegistry(): DsxuControlSessionRegistry {
    return this.config.controlRegistry ?? getDefaultDsxuControlSessionRegistry()
  }

  private recordConnectedControlSession(runtime: string): void {
    this.controlRegistry.upsertSession({
      sessionId: this.config.sessionId,
      mode: 'remote',
      status: 'connected',
      cwd: process.cwd(),
      viewerOnly: this.config.viewerOnly ?? false,
      metadata: {
        orgUuid: this.config.orgUuid,
        hasInitialPrompt: this.config.hasInitialPrompt ?? false,
        runtime,
      },
    })
  }

  connect(): void {
    logForDebugging(
      `[DSXURemoteSessionCoordinator] Connecting provider session ${this.config.sessionId}`,
    )
    void this.backend
      .createRemoteSession({
        sessionId: this.config.sessionId,
        cwd: process.cwd(),
        metadata: {
          orgUuid: this.config.orgUuid,
          hasInitialPrompt: this.config.hasInitialPrompt ?? false,
          viewerOnly: this.config.viewerOnly ?? false,
          runtime: 'dsxu-remote-service',
        },
      })
      .then(handle => {
        if (handle.status !== 'connected') {
          throw new Error(
            handle.reason ??
              `DSXU provider session ${handle.sessionId} was not connected`,
          )
        }
        this.recordConnectedControlSession('dsxu-control-plane')
        this.connected = true
        this.callbacks.onConnected?.()
        this.callbacks.onMessage(
          createSystemStatusMessage('init', {
            slash_commands: [],
            session_id: this.config.sessionId,
            provider: 'dsxu',
          }),
        )
      })
      .catch(error => {
        const normalized =
          error instanceof Error ? error : new Error(String(error))
        logError(normalized)
        this.callbacks.onError?.(normalized)
      })
  }

  async sendMessage(
    content: RemoteMessageContent,
    opts?: { uuid?: string },
  ): Promise<boolean> {
    if (!this.connected) {
      logForDebugging(
        `[DSXURemoteSessionCoordinator] Sending before connected; creating provider session ${this.config.sessionId}`,
      )
      const handle = await this.backend.createRemoteSession({
        sessionId: this.config.sessionId,
        cwd: process.cwd(),
        metadata: { runtime: 'dsxu-remote-service-lazy-connect' },
      })
      if (handle.status !== 'connected') {
        const error = new Error(
          handle.reason ??
            `DSXU provider session ${this.config.sessionId} was not connected`,
        )
        logError(error)
        this.callbacks.onError?.(error)
        return false
      }
      this.recordConnectedControlSession('dsxu-control-plane-lazy-connect')
      this.connected = true
      this.callbacks.onConnected?.()
    }

    const summary = remoteContentToSummary(content)
    const result = this.backend.postPeerMessage({
      fromSessionId: getSessionId(),
      targetSessionId: this.config.sessionId,
      message: summary,
      summary: summary.slice(0, 160),
    })
    this.controlRegistry.recordMessage(this.config.sessionId, {
      direction: 'outbound',
      type: 'peer_message',
      summary: summary.slice(0, 160),
    })

    if (!result.ok) {
      const error = new Error(
        result.error ??
          `Failed to send DSXU provider message to ${this.config.sessionId}`,
      )
      logError(error)
      this.callbacks.onError?.(error)
      return false
    }

    this.callbacks.onMessage(
      createEchoUserMessage(this.config.sessionId, content, opts?.uuid),
    )
    return true
  }

  respondToPermissionRequest(
    requestId: string,
    result: RemotePermissionResponse,
  ): void {
    const pendingRequest = this.pendingPermissionRequests.get(requestId)
    if (!pendingRequest) {
      logError(
        new Error(
          `[DSXURemoteSessionCoordinator] No pending permission request with ID: ${requestId}`,
        ),
      )
      return
    }

    this.pendingPermissionRequests.delete(requestId)
    this.controlRegistry.recordPermissionResponse({
      sessionId: this.config.sessionId,
      requestId,
      response:
        result.behavior === 'allow'
          ? { behavior: 'allow', updatedInput: result.updatedInput }
          : { behavior: 'deny', message: result.message },
    })
    this.backend.provider.emitEvent({
      type: 'permission_requested',
      sessionId: this.config.sessionId,
      toolName: pendingRequest.tool_name,
      timestamp: Date.now(),
    })
    logForDebugging(
      `[DSXURemoteSessionCoordinator] Permission response recorded: ${result.behavior}`,
    )
  }

  isConnected(): boolean {
    return this.connected
  }

  cancelSession(): void {
    logForDebugging('[DSXURemoteSessionCoordinator] Cancel requested')
    this.backend.synchronizeTask({
      type: 'task_synchronized',
      sessionId: this.config.sessionId,
      taskId: `remote-${this.config.sessionId}`,
      status: 'failed',
      timestamp: Date.now(),
    })
    this.callbacks.onMessage(
      createSystemStatusMessage('task_notification', {
        task_id: `remote-${this.config.sessionId}`,
        session_id: this.config.sessionId,
        status: 'cancelled',
      }),
    )
  }

  getSessionId(): string {
    return this.config.sessionId
  }

  disconnect(): void {
    logForDebugging('[DSXURemoteSessionCoordinator] Disconnecting')
    this.connected = false
    this.pendingPermissionRequests.clear()
    this.controlRegistry.closeSession(this.config.sessionId)
    this.callbacks.onDisconnected?.()
  }

  reconnect(): void {
    logForDebugging('[DSXURemoteSessionCoordinator] Reconnecting')
    this.callbacks.onReconnecting?.()
    this.connect()
  }

  injectControlMessageForTest(
    message:
      | SDKControlRequest
      | SDKControlResponse
      | SDKControlCancelRequest,
  ): void {
    if (message.type === 'control_request') {
      const { request_id, request } = message
      if (request.subtype === 'can_use_tool') {
        this.pendingPermissionRequests.set(request_id, request)
        this.controlRegistry.recordPermissionRequest({
          sessionId: this.config.sessionId,
          requestId: request_id,
          toolUseId: request.tool_use_id,
          toolName: request.tool_name,
          input: request.input,
        })
        this.callbacks.onPermissionRequest(request, request_id)
      }
      return
    }
    if (message.type === 'control_cancel_request') {
      const pending = this.pendingPermissionRequests.get(message.request_id)
      this.pendingPermissionRequests.delete(message.request_id)
      this.controlRegistry.cancelPermissionRequest(
        this.config.sessionId,
        message.request_id,
      )
      this.callbacks.onPermissionCancelled?.(
        message.request_id,
        pending?.tool_use_id,
      )
    }
  }
}

export function createRemoteSessionConfig(
  sessionId: string,
  getAccessToken: () => string,
  orgUuid: string,
  hasInitialPrompt = false,
  viewerOnly = false,
  controlRegistry?: DsxuControlSessionRegistry,
): RemoteSessionConfig {
  return {
    sessionId,
    getAccessToken,
    orgUuid,
    hasInitialPrompt,
    viewerOnly,
    controlRegistry,
  }
}
