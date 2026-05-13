// DSXU browser MCP provider boundary.
//
// The old implementation loaded a provider-specific Chrome MCP package at
// module import time. That made the default DSXU CLI fail whenever the optional
// browser provider dependency was absent. The default product path is now the
// DSXU CLI, so this facade is self-contained and degrades browser automation
// with an explicit tool error instead of crashing startup.

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ListToolsResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

export type DsxuBrowserContext = Record<string, unknown>
export type DsxuBrowserLogger = {
  debug?: (message: string, ...args: unknown[]) => void
  info?: (message: string, ...args: unknown[]) => void
  warn?: (message: string, ...args: unknown[]) => void
  error?: (message: string, ...args: unknown[]) => void
}
export type DsxuBrowserPermissionMode =
  | 'ask'
  | 'skip_all_permission_checks'
  | 'follow_a_plan'

const BROWSER_TOOL_NAMES = [
  'tabs_context_mcp',
  'tabs_create_mcp',
  'javascript_tool',
  'read_console_messages',
  'gif_creator',
] as const

export const BROWSER_TOOLS: Tool[] = BROWSER_TOOL_NAMES.map(name => ({
  name,
  description:
    'Optional DSXU browser automation tool. The browser provider is not installed in the default CLI-only build.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: true,
  },
}))

export function createDsxuBrowserMcpServer(context: DsxuBrowserContext) {
  const logger = (context.logger ?? {}) as DsxuBrowserLogger
  const server = new Server(
    {
      name: 'dsxu/browser-provider',
      version: MACRO.VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (): Promise<ListToolsResult> => ({ tools: BROWSER_TOOLS }),
  )

  server.setRequestHandler(
    CallToolRequestSchema,
    async ({ params: { name } }): Promise<CallToolResult> => {
      logger.warn?.(
        `DSXU browser provider tool "${name}" was requested, but the optional browser provider is not installed.`,
      )
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text:
              'DSXU Browser Provider is disabled in this CLI-only build. Use the normal DSXU CLI tools, or install a DSXU-owned browser provider before enabling browser MCP tools.',
          },
        ],
      }
    },
  )

  return server
}
