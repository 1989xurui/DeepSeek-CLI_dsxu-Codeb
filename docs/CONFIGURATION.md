# DSXU Code Configuration

DSXU 配置目标是 DeepSeek 原侧主线优先，旧 provider 配置只能作为显式 migration boundary、外部兼容输入或测试证据。

## Priority

1. CLI flags。
2. `.env` / process environment。
3. DSXU config files under `.dsxu`。
4. Project-level MCP/skill/plugin config。
5. Explicit archived-provider fallback gates。

旧 provider env 不能比 DSXU env 优先。

## Core Model Config

| Variable | Required | Purpose |
|---|---:|---|
| `DSXU_CODE_MODE=1` | yes | DSXU mainline mode。 |
| `DSXU_MODEL_PROVIDER=deepseek` | yes | Main provider owner。 |
| `DSXU_MODEL_GATEWAY=direct` | yes | Direct DeepSeek gateway。 |
| `DSXU_API_KEY` | one key | Preferred DSXU key。 |
| `DEEPSEEK_API_KEY` | one key | DeepSeek-compatible key。 |
| `DSXU_DEEPSEEK_API_KEY` | one key | DSXU DeepSeek key alias。 |
| `DSXU_MODEL` | no | Default model id。 |

Default model examples:

- `deepseek-v4-flash`
- `deepseek-v4-flash-max`
- `deepseek-v4-pro`

## Explicit Fallback Gates

Fallbacks are not default runtime paths.

| Variable | Meaning |
|---|---|
| `DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS=1` | Allow model fallback after explicit owner approval。 |
| `DSXU_ALLOW_PROVIDER_MIGRATION_PROXY_FALLBACK=1` | Allow archived-provider proxy fallback。 |
| `DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1` | Allow provider SDK / service shell path。 |

If these are absent, DSXU should fail closed instead of silently entering a second provider runtime.

Provider-specific migration gates that include third-party names are internal owner-review inputs, not public release configuration or product positioning.

## MCP / Skills / Plugins

MCP, skills, and plugins must enter the existing owners:

- MCP schema and clients: `src/services/mcp/*`
- MCP tools: `src/tools/MCPTool/*` and tool registry paths
- Skills: `src/skills/*`
- Plugins: `src/utils/plugins/*`

External configs such as `.mcp.json`, plugin MCP servers, external-code project intake, external agent hosts, external chat clients, terminal hosts, and browser automation providers are intake formats. They are not DSXU runtime owners.

Use the MCP doctor to verify this boundary without spawning servers:

```bash
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json
```

Expected release evidence includes server counts, transport/scope grouping, config errors, registry configured state, and whether any server is only an archived compatibility boundary.

## Release Exclusions

Do not include local evidence or build cache in clean export:

- `.dsxu/trace`
- `.dsxu/runs`
- `node_modules`
- local raw logs
- target/reference private artifacts

Release export must be produced only after V20 final gates pass.
