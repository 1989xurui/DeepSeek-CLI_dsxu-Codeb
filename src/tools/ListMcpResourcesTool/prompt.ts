export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool'

export const DESCRIPTION = `
Lists available resources from configured MCP servers.
Each resource object includes a 'server' field indicating which server it's from.

Usage examples:
- List all resources from all servers: \`listMcpResources\`
- List resources from a specific server: \`listMcpResources({ server: "myserver" })\`

DSXU weak-model discipline:
- When to use: discover exact MCP resource URIs before ReadMcpResourceTool, or confirm that a server has no relevant resources.
- When not to use: do not use this for local file discovery; use Glob/Grep/Read for the workspace.
- Recovery after failure: if a server is unavailable, continue with built-in DSXU tools when they can answer the task, and report the MCP gap.
- Weak-model anti-pattern: do not infer or invent resource URIs. Use only returned URIs or user-provided URIs.
- Verification / evidence: cite the server and returned URI list used for the next ReadMcpResource call; do not claim resource content was read from listing alone.
`

export const PROMPT = `
List available resources from configured MCP servers.
Each returned resource will include all standard MCP resource fields plus a 'server' field 
indicating which server the resource belongs to.

Parameters:
- server (optional): The name of a specific MCP server to get resources from. If not provided,
  resources from all servers will be returned.

Do not copy credential-like fields from resource metadata into later prompts or summaries.

DSXU weak-model discipline:
- When to use: discover exact MCP resource URIs before ReadMcpResourceTool, or confirm that a server has no relevant resources.
- When not to use: do not use this for local file discovery; use Glob/Grep/Read for the workspace.
- Recovery after failure: if a server is unavailable, continue with built-in DSXU tools when they can answer the task, and report the MCP gap.
- Weak-model anti-pattern: do not infer or invent resource URIs. Use only returned URIs or user-provided URIs.
- Verification / evidence: cite the server and returned URI list used for the next ReadMcpResource call; do not claim resource content was read from listing alone.
`
