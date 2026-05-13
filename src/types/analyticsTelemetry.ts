type JsonRecord = Record<string, unknown>
type TelemetryEventCodec = {
  toJSON(input: JsonRecord): JsonRecord
  fromJSON?(input: unknown): JsonRecord
}

export const DSXU_TELEMETRY_INTERNAL_EVENT_TYPE =
  'DsxuCodeInternalEvent' as const

export const DsxuInternalTelemetryEvent: TelemetryEventCodec = {
  toJSON(input: JsonRecord): JsonRecord {
    return { ...input }
  },
  fromJSON(input: unknown): JsonRecord {
    return input && typeof input === 'object'
      ? { ...(input as JsonRecord) }
      : {}
  },
}

export type DsxuTelemetryEnvironmentMetadata = JsonRecord
export type DsxuTelemetryPublicApiAuth = JsonRecord

export const DSXU_TELEMETRY_ENV_FIELDS = {
  isRemote: 'is_dsxu_code_remote',
  isAction: 'is_dsxu_code_action',
  isLegacyCloudAuth: 'is_legacy_cloud_auth',
  containerId: 'dsxu_code_container_id',
  remoteSessionId: 'dsxu_code_remote_session_id',
} as const

export const LEGACY_ACTION_PATH_SEGMENT = 'dsxu-code-action/'
