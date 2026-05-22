import type {
  DsxuControlPermissionRequest,
  DsxuControlSession,
  DsxuControlSessionRegistry,
} from './controlSession.js'
import {
  createDsxuVisiblePermissionPrompt,
  type DsxuVisiblePermissionPrompt,
} from './permissionControlBridge.js'

export type DsxuOperatorStateProjection = {
  runtime: 'DSXU Operator Visible-State Projection'
  owner: 'DSXU Control Plane Visible-State Owner'
  sessionCount: number
  activeSessionCount: number
  pendingPermissionCount: number
  answeredPermissionCount: number
  cancelledPermissionCount: number
  visiblePermissionPrompts: DsxuVisiblePermissionPrompt[]
  sessionSummaries: {
    sessionId: string
    mode: DsxuControlSession['mode']
    status: DsxuControlSession['status']
    viewerOnly: boolean
    cwd?: string
    messageCount: number
    pendingPermissionCount: number
    lastMessageSummary?: string
  }[]
  releaseRiskControls: readonly string[]
}

export function getDsxuOperatorStateProjectionRuntimeProfile(): {
  runtime: 'DSXU Operator Visible-State Projection'
  owner: 'DSXU Control Plane Visible-State Owner'
  activationEvidence: readonly string[]
  releaseRiskControls: readonly string[]
} {
  return {
    runtime: 'DSXU Operator Visible-State Projection',
    owner: 'DSXU Control Plane Visible-State Owner',
    activationEvidence: [
      'operator dashboard reads DsxuControlSessionRegistry snapshots only',
      'permission prompts are projected through permissionControlBridge visible prompts',
      'remote session status, cwd, viewerOnly state, and message summaries remain read-side state',
      'operator state is derived from registry data and does not execute tools or models',
    ],
    releaseRiskControls: [
      'operator UI/TUI is a projection surface, not a Query Loop runtime',
      'permission responses are written back through control-plane permission bridge',
      'pending permission wait state is visible and cannot become hidden waiting',
      'dashboard state does not create provider, MCP, shell, or tool execution clients',
    ],
  }
}

function countPermissionStatus(
  requests: DsxuControlPermissionRequest[],
  status: DsxuControlPermissionRequest['status'],
): number {
  return requests.filter(request => request.status === status).length
}

export function buildDsxuOperatorStateProjection(
  registry: DsxuControlSessionRegistry,
): DsxuOperatorStateProjection {
  const profile = getDsxuOperatorStateProjectionRuntimeProfile()
  const sessions = registry.listSessions()
  const allRequests = sessions.flatMap(session =>
    Object.values(session.permissionRequests),
  )
  const visiblePermissionPrompts = sessions.flatMap(session =>
    Object.values(session.permissionRequests)
      .filter(request => request.status === 'pending')
      .map(request =>
        createDsxuVisiblePermissionPrompt({
          sessionId: session.sessionId,
          request,
        }),
      ),
  )

  return {
    runtime: profile.runtime,
    owner: profile.owner,
    sessionCount: sessions.length,
    activeSessionCount: sessions.filter(session => session.status !== 'closed')
      .length,
    pendingPermissionCount: countPermissionStatus(allRequests, 'pending'),
    answeredPermissionCount: countPermissionStatus(allRequests, 'answered'),
    cancelledPermissionCount: countPermissionStatus(allRequests, 'cancelled'),
    visiblePermissionPrompts,
    sessionSummaries: sessions.map(session => {
      const permissionRequests = Object.values(session.permissionRequests)
      const lastMessage = session.messages.at(-1)
      return {
        sessionId: session.sessionId,
        mode: session.mode,
        status: session.status,
        viewerOnly: session.viewerOnly,
        cwd: session.cwd,
        messageCount: session.messages.length,
        pendingPermissionCount: countPermissionStatus(
          permissionRequests,
          'pending',
        ),
        lastMessageSummary: lastMessage?.summary,
      }
    }),
    releaseRiskControls: profile.releaseRiskControls,
  }
}
