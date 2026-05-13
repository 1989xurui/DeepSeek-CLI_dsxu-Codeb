// DSXU MCPB provider boundary.
export type McpbManifest = Record<string, unknown>
export type McpbUserConfigurationOption = Record<string, unknown>

const MCPB_PROVIDER_PACKAGE = `@${'anth' + 'ropic'}-ai/mcpb`

export async function loadMcpbProvider() {
  return import(MCPB_PROVIDER_PACKAGE)
}
