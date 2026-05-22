export const DESCRIPTION = `
Reads a specific resource from an MCP server.
- server: The name of the MCP server to read from
- uri: The URI of the resource to read

Usage examples:
- Read a resource from a server: \`readMcpResource({ server: "myserver", uri: "my-resource-uri" })\`

DSXU weak-model discipline:
- When to use: read an exact MCP resource URI returned by ListMcpResourcesTool or provided by the user.
- When not to use: do not use this for local project files, web pages, shell commands, or dynamic MCP tools.
- Recovery after failure: if the URI is missing or stale, list resources for that server and retry once with the exact URI; otherwise report unavailable.
- Weak-model anti-pattern: never expose credential-like content returned by a resource; summarize only the non-secret evidence needed for the task.
- Verification / evidence: cite the server and resource URI plus the non-secret facts used; do not treat unreadable or redacted content as task completion.
`

export const PROMPT = `
Reads a specific resource from an MCP server, identified by server name and resource URI.

Parameters:
- server (required): The name of the MCP server from which to read the resource
- uri (required): The URI of the resource to read

Follow the DSXU MCP credential boundary: credential-like values in resource content must not be repeated into the conversation or used as tool arguments unless the user explicitly provided that exact value for this task.

DSXU weak-model discipline:
- When to use: read an exact MCP resource URI returned by ListMcpResourcesTool or provided by the user.
- When not to use: do not use this for local project files, web pages, shell commands, or dynamic MCP tools.
- Recovery after failure: if the URI is missing or stale, list resources for that server and retry once with the exact URI; otherwise report unavailable.
- Weak-model anti-pattern: never expose credential-like content returned by a resource; summarize only the non-secret evidence needed for the task.
- Verification / evidence: cite the server and resource URI plus the non-secret facts used; do not treat unreadable or redacted content as task completion.
`
