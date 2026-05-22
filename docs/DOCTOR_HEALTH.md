# DSXU Doctor and Health

Doctor/health is a user support and release evidence surface. It must explain current capability and failure causes; it must not hide owner gaps or convert warnings into release PASS.

## User Commands

```bash
npm run audit:dsxu:health
npm run test:dsxu:release
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx --version
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json
```

`mcp doctor` is the current MCP-specific doctor surface. It reads configured MCP servers, registry state, config errors, owner boundaries, and release readiness without spawning MCP servers.

Any future CLI doctor command must report the same owner boundaries as this document.

## Required Health Fields

| Field | Meaning |
|---|---|
| `entrypoint` | Active DSXU entrypoint and version。 |
| `mode` | Whether `DSXU_CODE_MODE=1` is active。 |
| `modelProvider` | DeepSeek mainline or explicit migration fallback。 |
| `modelGateway` | Direct / local gateway / explicit fallback。 |
| `toolGate` | Whether tools are routed through DSXU Tool Gate。 |
| `permissionGate` | Whether dangerous tools require explicit permission。 |
| `mcp` | MCP servers, registry state, auth state, failed servers。 |
| `skills` | Loaded skills, conflicts, disabled entries。 |
| `agents` | Agent/task runtime owner and active background tasks。 |
| `evidence` | Local evidence paths and release exclusions。 |
| `releaseGate` | V20 PASS / PARTIAL / BLOCKED reason。 |

## Failure Classes

- Missing DeepSeek key。
- No DSXU mode。
- Tool requested without permission。
- MCP server failed to spawn/connect/authenticate。
- Plugin or skill schema invalid。
- Provider-migration fallback requested without explicit gate。
- MCP registry disabled without release signoff。
- MCP provider-migration boundary present without explicit owner review。
- Evidence directory present but not release-exportable。
- Git owner review not closed。
- Clean export attempted before final gates。

## Release Rule

Doctor can prove readiness only after:

1. Owner/Git signoff is closed。
2. Deletion-state review is closed。
3. ACL residue is externally closed or signed off。
4. V20 real-gap productization is complete。
5. Six-stage real tests PASS。
6. Clean export preflight PASS。
