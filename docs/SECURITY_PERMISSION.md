# DSXU Security and Permission

V20 security is based on a single permission owner. Adapters may project permission state, but they cannot own product permission logic.

## Permission Owners

- `src/hooks/useCanUseTool.tsx`
- `src/utils/permissions/permissions.ts`
- `src/utils/permissions/*`
- `src/components/permissions/*`
- tool-specific permission modules

## High-Risk Actions

These must require explicit permission or a documented owner gate:

- shell command execution
- PowerShell execution
- file write/edit/delete
- network calls to external MCP/plugin/provider servers
- GitHub/Git mutation
- task stop/delete
- team create/delete
- worktree changes
- native test execution
- release/export generation

## Secrets

- Never print API keys in normal logs.
- Prefer `DSXU_API_KEY`, `DEEPSEEK_API_KEY`, or `DSXU_DEEPSEEK_API_KEY`.
- Provider-migration keys are not DSXU default runtime credentials.
- Diagnostic output should redact tokens and base64 credentials.

## Filesystem

Tools should respect:

- current workspace
- explicitly added directories
- ignored release paths
- evidence directories excluded from clean export

`.dsxu` can store evidence locally, but release/export must exclude trace and run artifacts unless a release owner explicitly includes a sanitized report.

## MCP and External Servers

MCP servers are adapter boundaries. They must expose:

- server name and command/URL
- auth state
- transport
- tool list
- permission requirements
- failure reason and recovery hint

No MCP server may bypass Tool Gate by directly writing files or executing shell commands through a separate runtime path.
