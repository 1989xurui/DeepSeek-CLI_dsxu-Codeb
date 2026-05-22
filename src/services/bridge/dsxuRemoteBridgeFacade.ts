import { stringWidth } from '../../ink/stringWidth.js'
import { formatDuration, truncateToWidth } from '../../utils/format.js'
import { getGraphemeSegmenter } from '../../utils/intl.js'

export type BridgePermissionResponse = {
  behavior: 'allow' | 'deny'
  updatedInput?: Record<string, unknown>
  updatedPermissions?: unknown[]
  message?: string
}

export type BridgePermissionCallbacks = {
  sendRequest(
    requestId: string,
    toolName: string,
    input: Record<string, unknown>,
    toolUseId: string,
    description: string,
    permissionSuggestions?: unknown[],
    blockedPath?: string,
  ): void
  sendResponse(requestId: string, response: BridgePermissionResponse): void
  cancelRequest(requestId: string): void
  onResponse(
    requestId: string,
    handler: (response: BridgePermissionResponse) => void,
  ): () => void
}

export type ReplBridgeHandle = {
  bridgeSessionId: string
  environmentId: string
  sessionIngressUrl: string
  writeMessages(messages: unknown[]): void
  writeSdkMessages(messages: unknown[]): void
  sendControlRequest(request: unknown): void
  sendControlResponse(response: unknown): void
  sendControlCancelRequest(requestId: string): void
  sendResult(): void
  teardown(): Promise<void>
}

export type DsxuControlSessionHandle = ReplBridgeHandle

export type BridgeState = 'ready' | 'connected' | 'reconnecting' | 'failed'
export type BridgeStatusView = {
  state: BridgeState
  label: string
  color: 'success' | 'warning' | 'error' | 'text'
}

export type InboundMessageFields = {
  content: unknown
  uuid?: string
}

export class BridgeFatalError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly errorType?: string,
  ) {
    super(message)
    this.name = 'BridgeFatalError'
  }
}

export const DEFAULT_POLL_CONFIG = {
  connected: { minMs: 1000, maxMs: 30_000 },
  reconnecting: { minMs: 1000, maxMs: 30_000 },
}

export class BoundedUUIDSet {
  private readonly values = new Set<string>()
  private readonly order: string[] = []

  constructor(private readonly maxSize = 1000) {}

  add(value: string): void {
    if (this.values.has(value)) return
    this.values.add(value)
    this.order.push(value)
    while (this.order.length > this.maxSize) {
      const oldest = this.order.shift()
      if (oldest) this.values.delete(oldest)
    }
  }

  has(value: string): boolean {
    return this.values.has(value)
  }
}

export const REMOTE_CONTROL_DISCONNECTED_MSG = 'Remote Control disconnected.'
export const FAILED_FOOTER_TEXT = 'Remote provider disconnected'
export const SHIMMER_INTERVAL_MS = 150
export const BRIDGE_LOGIN_INSTRUCTION =
  'Configure DSXU provider credentials before using remote provider features.'

export function getDsxuRemoteBridgeFacadeRuntimeProfile(): {
  runtime: 'DSXU Remote Bridge Facade'
  owner: 'DSXU Control Plane Adapter Boundary'
  activationEvidence: readonly string[]
  releaseRiskControls: readonly string[]
} {
  return {
    runtime: 'DSXU Remote Bridge Facade',
    owner: 'DSXU Control Plane Adapter Boundary',
    activationEvidence: [
      'isBridgeEnabled requires DSXU remote session token/base URL/use-remote env',
      'bridge status is projected as UI state instead of owning query execution',
      'archived bridge shell returns disabled messages by default',
      'control request/response types are forwarded to DSXU control-plane handlers',
    ],
    releaseRiskControls: [
      'remote bridge facade is not a second Query Loop',
      'remote bridge facade is not a second Tool Gate',
      'archived bridge peer sessions remain disabled unless explicitly replaced by DSXU provider routing',
    ],
  }
}

export function toCompatSessionId(sessionId: string): string {
  if (sessionId.startsWith('cse_')) {
    return `session_${sessionId.slice('cse_'.length)}`
  }
  return sessionId
}

export function isBridgeEnabled(): boolean {
  return Boolean(
    process.env.DSXU_REMOTE_SESSION_TOKEN ||
      process.env.DSXU_REMOTE_SESSION_BASE_URL ||
      process.env.DSXU_CODE_USE_REMOTE_SESSION,
  )
}

export function validateBridgeId(value: string, _name = 'id'): string {
  return value
}

export function isExpiredErrorType(value: string | undefined): boolean {
  return value === 'environment_expired' || value === 'session_expired'
}

export function isSuppressible403(error: unknown): boolean {
  return error instanceof BridgeFatalError && error.status === 403
}

export function createBridgeApiClient(): Record<string, never> {
  return {}
}

export function injectBridgeFault(): void {}

export function wrapApiForFaultInjection<T>(api: T): T {
  return api
}

export function setReplBridgeHandle(_handle: ReplBridgeHandle | null): void {}

export function getSelfBridgeCompatId(): string {
  return 'provider:local'
}

export function isEnvLessBridgeEnabled(): boolean {
  return false
}

export function isCcrMirrorEnabled(): boolean {
  return false
}

export function checkBridgeMinVersion(): string | null {
  return null
}

export async function checkEnvLessBridgeMinVersion(): Promise<string | null> {
  return null
}

export async function getBridgeDisabledReason(): Promise<string | null> {
  return 'Archived bridge shell is disabled; DSXU provider contract owns remote routing.'
}

export function getBridgeAccessToken(): string | undefined {
  return process.env.DSXU_REMOTE_SESSION_TOKEN
}

export function getBridgeBaseUrlOverride(): string | undefined {
  return process.env.DSXU_REMOTE_SESSION_BASE_URL
}

export function getBridgeTokenOverride(): string | undefined {
  return process.env.DSXU_REMOTE_SESSION_TOKEN
}

export function clearTrustedDeviceToken(): void {}

export function clearTrustedDeviceTokenCache(): void {}

export async function enrollTrustedDevice(): Promise<void> {}

export function getReplBridgeHandle(): ReplBridgeHandle | null {
  return null
}

export async function postInterDSXUMessage(
  _target: string,
  _message: string,
): Promise<{ ok: boolean; error?: string }> {
  return {
    ok: false,
    error: 'Archived bridge peer sessions are disabled; use provider: routing.',
  }
}

export async function updateBridgeSessionTitle(): Promise<void> {}

export function getBridgeStatus(input: {
  connected?: boolean
  sessionActive?: boolean
  reconnecting?: boolean
  failed?: boolean
  error?: unknown
}): BridgeStatusView {
  if (input.failed || input.error) {
    return { state: 'failed', label: 'Failed', color: 'error' }
  }
  if (input.reconnecting) {
    return { state: 'reconnecting', label: 'Reconnecting', color: 'warning' }
  }
  if (input.sessionActive || input.connected) {
    return { state: 'connected', label: 'Connected', color: 'success' }
  }
  return { state: 'ready', label: 'Ready', color: 'text' }
}

export function buildBridgeConnectUrl(
  environmentId: string,
  sessionIngressUrl?: string,
): string {
  const base = sessionIngressUrl || 'dsxu-provider://local'
  return environmentId ? `${base}?provider=${encodeURIComponent(environmentId)}` : base
}

export function buildDsxuControlConnectUrl(
  environmentId: string,
  sessionIngressUrl?: string,
): string {
  return buildBridgeConnectUrl(environmentId, sessionIngressUrl)
}

export function getDsxuControlSessionId(
  handle: DsxuControlSessionHandle,
): string {
  return handle.bridgeSessionId
}

export function extractInboundMessageFields(message: {
  message?: { content?: unknown }
  content?: unknown
  uuid?: string
}): InboundMessageFields | null {
  const content = message.message?.content ?? message.content
  if (content === undefined || content === null) return null
  return { content, uuid: message.uuid }
}

export function isBridgePermissionResponse(value: unknown): value is BridgePermissionResponse {
  if (!value || typeof value !== 'object') return false
  const behavior = (value as { behavior?: unknown }).behavior
  return behavior === 'allow' || behavior === 'deny'
}

export async function initReplBridge(
  _options?: unknown,
): Promise<ReplBridgeHandle | null> {
  return null
}

export async function initDsxuControlSession(
  options?: unknown,
): Promise<DsxuControlSessionHandle | null> {
  return initReplBridge(options)
}

export async function resolveAndPrepend(
  _message: unknown,
  content: unknown,
): Promise<unknown> {
  return content
}

export function decodeJwtExpiry(token: string): number | null {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    )
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      exp?: unknown
    }
    return typeof parsed.exp === 'number' ? parsed.exp : null
  } catch {
    return null
  }
}

export function buildActiveFooterText(sessionUrl?: string): string {
  return sessionUrl ? `Remote provider: ${sessionUrl}` : 'Remote provider connected'
}

export function createBridgeLogger() {
  return {
    log() {},
    debug() {},
    error() {},
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    )
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

export function createTokenRefreshScheduler() {
  return {
    schedule() {},
    scheduleFromExpiresIn() {},
    cancel() {},
    cancelAll() {},
  }
}

export function getTrustedDeviceToken(): string | undefined {
  return undefined
}

export function decodeWorkSecret(value: string): {
  session_ingress_token?: string
  api_base_url?: string
} | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      session_ingress_token?: string
      api_base_url?: string
    }
  } catch {
    return null
  }
}

export function buildSdkUrl(baseUrl: string, sessionId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/sdk/${encodeURIComponent(sessionId)}`
}

export function sameSessionId(left: string, right: string): boolean {
  return toCompatSessionId(left) === toCompatSessionId(right)
}

export function buildCCRv2SdkUrl(baseUrl: string, sessionId: string): string {
  return buildSdkUrl(baseUrl, sessionId)
}

export async function registerWorker(): Promise<{ ok: false; reason: string }> {
  return { ok: false, reason: 'archived source boundary' }
}

export function createCapacityWake(_signal?: AbortSignal) {
  return {
    signal() {
      const controller = new AbortController()
      return {
        signal: controller.signal,
        cleanup() {},
      }
    },
    wake() {},
  }
}

export function processCapacityWakeCycle(_signal?: AbortSignal) {
  return { state: 'archived', woke: false }
}

export function processBridgeStatusUpdate(input: {
  connected?: boolean
  sessionActive?: boolean
  reconnecting?: boolean
  error?: unknown
}) {
  const status = getBridgeStatus(input)
  return { state: status.state, status }
}

export async function createCodeSession(): Promise<string | null> {
  return null
}

export async function fetchRemoteCredentials(): Promise<null> {
  return null
}

export function invokeCodeSessionLifecycle(input: Record<string, unknown>) {
  return { ...input, archived: true }
}

export function getBridgeBaseUrl(): string {
  return process.env.DSXU_REMOTE_SESSION_BASE_URL ?? 'dsxu-provider://local'
}

export async function createBridgeSession(): Promise<null> {
  return null
}

export async function getBridgeSession(): Promise<null> {
  return null
}

export async function archiveBridgeSession(): Promise<void> {}

export function processBridgeSessionLifecycle(input: Record<string, unknown>) {
  return { ...input, archived: true }
}

export function extractTitleText(message: { message?: { content?: unknown } }): string {
  const content = message.message?.content
  return typeof content === 'string' ? content : ''
}

export function makeResultMessage(sessionId: string) {
  return { type: 'result', session_id: sessionId }
}

export function isSDKMessage(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'type' in value)
}

export function isSDKControlRequest(value: unknown): boolean {
  return (
    Boolean(value && typeof value === 'object') &&
    (value as { type?: unknown }).type === 'control_request'
  )
}

export function isSDKControlResponse(value: unknown): boolean {
  return (
    Boolean(value && typeof value === 'object') &&
    (value as { type?: unknown }).type === 'control_response'
  )
}

export function processRemoteBridgeCoreLifecycle(input: Record<string, unknown>) {
  return { ...input, archived: true }
}

export function processReplBridgeLifecycle(input: Record<string, unknown>) {
  return { ...input, archived: true }
}

export function initBridgeCore(): null {
  return null
}

export function processSessionRunnerLifecycle(input: Record<string, unknown>) {
  return { ...input, archived: true }
}

export function safeFilenameId(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, '_')
}

export function createSessionSpawner(): null {
  return null
}

export function parseArgs(args: string[]): { args: string[]; archived: true } {
  return { args, archived: true }
}

export function processBridgeMainLifecycle(
  args: string[],
  error?: unknown,
): { args: string[]; error: unknown; archived: true } {
  return { args, error, archived: true }
}

export function isConnectionError(error: { code?: string }): boolean {
  return error.code === 'ECONNRESET'
}

export function isServerError(error: { code?: string }): boolean {
  return error.code === 'ERR_BAD_RESPONSE'
}

export async function runBridgeLoop(): Promise<null> {
  return null
}

export function buildIdleFooterText(connectUrl?: string): string {
  return connectUrl ? `Remote provider ready: ${connectUrl}` : 'Remote provider ready'
}

export function timestamp(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export { formatDuration, truncateToWidth as truncatePrompt }

export function computeGlimmerIndex(
  tick: number,
  messageWidth: number,
): number {
  const cycleLength = messageWidth + 20
  return messageWidth + 10 - (tick % cycleLength)
}

export function computeShimmerSegments(
  text: string,
  glimmerIndex: number,
): { before: string; shimmer: string; after: string } {
  const messageWidth = stringWidth(text)
  const shimmerStart = glimmerIndex - 1
  const shimmerEnd = glimmerIndex + 1
  if (shimmerStart >= messageWidth || shimmerEnd < 0) {
    return { before: text, shimmer: '', after: '' }
  }
  const clampedStart = Math.max(0, shimmerStart)
  let colPos = 0
  let before = ''
  let shimmer = ''
  let after = ''
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (colPos + segWidth <= clampedStart) {
      before += segment
    } else if (colPos > shimmerEnd) {
      after += segment
    } else {
      shimmer += segment
    }
    colPos += segWidth
  }
  return { before, shimmer, after }
}

export function getPollIntervalConfig() {
  return {
    minMs: 1000,
    maxMs: 30_000,
    jitterRatio: 0.2,
  }
}

export function getBridgeDebugHandle(): null {
  return null
}
