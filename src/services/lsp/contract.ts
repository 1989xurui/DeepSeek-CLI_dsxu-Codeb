// DSXU V18 ownership marker: LSP capability contract is owned by DSXU mainline.

export type LspMethod =
  | 'hover'
  | 'completion'
  | 'codeAction'
  | 'diagnostics'
  | 'references'
  | 'definition'

export interface LspRequest {
  method: LspMethod
  params: {
    textDocument: { uri: string }
    position: { line: number; character: number }
    context?: unknown
  }
}

export interface LspResponse {
  method: LspMethod
  result: unknown
  durationMs: number
}

export interface LspServerConfig {
  port?: number
  /** Mock handler for clean tests and provider smoke. */
  mockHandler?: (req: LspRequest) => Promise<unknown>
}

export type DsxuLspProviderStatus = {
  provider: 'DSXU LSP Provider'
  defaultMainline: 'enabled' | 'disabled'
  visibility: 'tool-visible' | 'hidden-until-connected'
  fallback: 'returns-not-connected-evidence'
}

export function getDsxuLspProviderStatus(): DsxuLspProviderStatus {
  const enabled =
    process.env.DSXU_CODE_MODE === '1' && process.env.ENABLE_LSP_TOOL === '1'
  return {
    provider: 'DSXU LSP Provider',
    defaultMainline: enabled ? 'enabled' : 'disabled',
    visibility: enabled ? 'tool-visible' : 'hidden-until-connected',
    fallback: 'returns-not-connected-evidence',
  }
}

export function getDsxuLspRuntimeProfile(): DsxuLspProviderStatus & {
  runtime: 'DSXU LSP Runtime'
  methods: readonly LspMethod[]
  evidencePolicy: string
} {
  return {
    runtime: 'DSXU LSP Runtime',
    ...getDsxuLspProviderStatus(),
    methods: [
      'hover',
      'completion',
      'codeAction',
      'diagnostics',
      'references',
      'definition',
    ],
    evidencePolicy:
      'LSP results enter DSXU diagnostics/context evidence only when provider is connected; otherwise return not-connected evidence',
  }
}
