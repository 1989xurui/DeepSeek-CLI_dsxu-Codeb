# DSXU VS Code Extension Adapter - 2026-05-22

## Decision

VS Code support is implemented as an IDE adapter, not as a second DSXU runtime.

The adapter owns:

- VS Code command palette entries.
- Editor selection and current-file handoff.
- Integrated terminal launch.
- Status bar and output-channel visibility.
- Local source install into the VS Code extensions folder.

DSXU still owns:

- DeepSeek model routing.
- Tool Gate and Permission Gate.
- Source-truth reading and patching.
- Recovery, cost/cache evidence, and final reports.
- Release claim boundaries.

## Implemented Surface

| Surface | Status | Owner boundary |
|---|---|---|
| `integrations/vscode/package.json` | implemented | VS Code contribution metadata only |
| `integrations/vscode/extension.js` | implemented | delegates to `src/entrypoints/dsxu-code.tsx` |
| `DSXU Code: Open` | implemented | opens DSXU CLI/TUI in VS Code terminal |
| `DSXU Code: Ask About Selection` | implemented | writes `.dsxu/vscode-prompts/*.md` and calls DSXU print mode |
| `DSXU Code: Explain Current File` | implemented | artifact handoff, no direct edit |
| `DSXU Code: Configure DeepSeek Key` | implemented | runs existing `auth login` |
| `DSXU Code: Run Doctor` | implemented | runs existing auth/doctor path |
| Windows/macOS/Linux source install | implemented | copies adapter into VS Code extension folder |
| Smoke verification | implemented | `bun run ide:vscode-smoke` |

## Explicit Non-Goals

- No direct DeepSeek HTTP call inside the extension.
- No second permission layer inside VS Code.
- No second tool bus.
- No standalone MCP/agent/provider runtime inside the extension.
- No public benchmark or 90/95-point claim from this adapter.

## Verification

Run:

```bash
bun run ide:vscode-smoke
```

The smoke verifies:

- extension commands exist;
- commands delegate to DSXU CLI entrypoint;
- no direct provider client is implemented;
- selection payloads are persisted as prompt artifacts instead of huge shell arguments;
- Windows and Unix install scripts copy only the adapter;
- README and install docs include the VS Code path.
