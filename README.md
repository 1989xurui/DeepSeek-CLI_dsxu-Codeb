# DSXU Code

DSXU Code is a local AI coding CLI/TUI focused on DeepSeek-backed coding workflows, long-context project reasoning, tool execution, skills, agents, MCP providers, and workflow automation.

The current mainline entrypoints are DSXU-owned:

- `bin/dsxu-code`
- `bun run dsxu-code`
- `bun run start`
- `Start-DSXU-Code-WSL.cmd` on Windows

Legacy-compatible files and protocol names are kept only where they are still needed for migration, provider compatibility, or audit evidence. Pristine upstream source is read-only comparison material and is handled only through audit workflows.

## Quick Start

Install dependencies:

```bash
npm install
```

Create local environment settings:

```bash
cp .env.example .env
```

Minimal direct DeepSeek setup:

```env
DSXU_CODE_MODE=1
DSXU_MODEL_PROVIDER=deepseek
DSXU_MODEL_GATEWAY=direct
DEEPSEEK_API_KEY=your_deepseek_key_here
DSXU_MODEL=deepseek-v4-flash
```

Start the interactive DSXU terminal:

```bash
bun run dsxu-code
```

Run one print-mode prompt:

```bash
bin/dsxu-code -p "summarize this repo"
```

Run a tool-enabled print-mode task:

```bash
bin/dsxu-code -p --tools Read,Edit,Bash --allowedTools Read,Edit,Bash "read README.md and print the first heading"
```

## Main Capabilities

- DeepSeek XML/free-form tool-call normalization into DSXU tool-use blocks.
- Real Read, Edit, Bash, Grep, Glob, MCP, agent, and workflow runtime paths.
- DSXU-first `.dsxu` configuration, skill, workflow, and managed settings loading, with legacy fallback only where migration requires it.
- WorkflowTool runtime for DSXU workflows consumed through the tool registry and prompt context.
- Automatic Skill/Agent/MCP trigger matrix for code review, TDD, security, context compression, prompt cache, and workflow goals.
- Usage, cost, prompt-cache, and reasoning-token accounting for DeepSeek model calls.
- Batch regression gate for real tool/runtime/project checks.

## Configuration

Primary DSXU variables:

| Variable | Purpose |
|---|---|
| `DSXU_CODE_MODE` | Set to `1` for DSXU mainline behavior. |
| `DSXU_MODEL_PROVIDER` | Default provider selector, usually `deepseek`. |
| `DSXU_MODEL_GATEWAY` | Model gateway. The default CLI path uses `direct`. |
| `DEEPSEEK_API_KEY` | Direct DeepSeek API key. |
| `DSXU_API_KEY` | DSXU-owned API key alias accepted by DSXU auth paths. |
| `DSXU_DEEPSEEK_API_KEY` | DSXU-specific DeepSeek key alias. |
| `DSXU_MODEL` | Preferred DSXU model id. |
| `API_TIMEOUT_MS` | Request timeout in milliseconds. |

Legacy provider variables may still be read by isolated compatibility paths, but new DSXU configuration should use the DSXU/DeepSeek variables above.

## Runtime Gates

Use focused runtime checks after each cleanup or absorption batch:

```bash
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx --version
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx -p "/help" --output-format json
bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts
bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts
```

The default gate currently covers:

- DSXU entrypoint ownership
- DeepSeek adapter importability
- print-mode slash dispatch
- real Read/Edit/Bash/Grep/Glob/PowerShell/Todo/LSP adapter paths
- provider shell isolation

## Audit Discipline

Current operation plans live under `.dsxu/ops/`. Historical audit material and non-default sidecar shells are archived under `非dsxu-code项目文件/`.

The cleanup rule is:

- Absorb useful upstream semantics into active DSXU runtime paths.
- Rewrite user-facing copy and commands to DSXU-owned names.
- Keep provider protocol strings only where guarded compatibility requires them.
- Move unused legacy, experiment, or sidecar shell material into explicit isolation/history.
- Never mutate pristine upstream comparison material; use it only for final file-level audits.

## Project Layout

```text
bin/dsxu-code                 DSXU CLI/TUI launcher
src/entrypoints/dsxu-code.tsx DSXU product entrypoint
src/services/api/             model providers and DeepSeek adapter
src/tools/                    tool runtimes and registry integration
src/skills/                   skill discovery and bundled skills
src/dsxu/engine/              DSXU capability engine and tests
.dsxu/ops/                    operation plans and mainline ledgers
非dsxu-code项目文件/           archived non-default sidecars and historical assets
```
