/**
 * Pure utility functions for MCP name normalization.
 * This file has no dependencies to avoid circular imports.
 */

const DSXU_SERVER_PREFIX = 'dsxu '

/**
 * Normalize server names to be compatible with the API pattern ^[a-zA-Z0-9_-]{1,64}$
 * Replaces any invalid characters (including dots and spaces) with underscores.
 *
 * For DSXU provider names, also collapses consecutive underscores and strips
 * leading/trailing underscores to keep MCP tool delimiters stable.
 */
export function normalizeNameForMCP(name: string): string {
  let normalized = name.replace(/[^a-zA-Z0-9_-]/g, '_')
  if (name.startsWith(DSXU_SERVER_PREFIX)) {
    normalized = normalized.replace(/_+/g, '_').replace(/^_|_$/g, '')
  }
  return normalized
}

export function getDsxuMcpNormalizationRuntimeProfile(): {
  runtime: 'DSXU MCP Name Normalization'
  delimiterPolicy: string
  prefixes: readonly string[]
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU MCP Name Normalization',
    delimiterPolicy:
      'server names are normalized to API-safe characters and stripped of repeated/edge underscores so mcp__server__tool delimiters remain stable',
    prefixes: ['dsxu '],
    activationEvidence: [
      'normalizes arbitrary MCP provider names into ^[a-zA-Z0-9_-]{1,64}-compatible strings',
      'collapses repeated underscores for DSXU provider prefixes',
      'keeps provider naming product-owned instead of routing through historical cloud prefixes',
    ],
  }
}
