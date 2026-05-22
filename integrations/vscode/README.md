# DSXU Code VS Code Adapter

This extension is a VS Code adapter for DSXU Code. It does not contain a model
provider, a second tool runtime, or a second permission system. Every command
delegates to the existing DSXU CLI mainline in `src/entrypoints/dsxu-code.tsx`.

## Commands

- `DSXU Code: Open`
- `DSXU Code: Ask About Selection`
- `DSXU Code: Explain Current File`
- `DSXU Code: Configure DeepSeek Key`
- `DSXU Code: Run Doctor`
- `DSXU Code: Open Install Guide`

## Settings

- `dsxuCode.repoPath`: absolute path to the DSXU Code checkout.
- `dsxuCode.bunPath`: optional Bun executable path.
- `dsxuCode.defaultModel`: default DSXU model environment value.
- `dsxuCode.openTerminalOnStart`: show the terminal after launch.
- `dsxuCode.promptArtifactDir`: where selection prompt artifacts are written.

## Boundary

The extension is intentionally thin:

- VS Code owns editor selection, command palette, status bar, and terminal UX.
- DSXU owns planning, model routing, tool gates, permission gates, recovery,
  cost/cache evidence, and final reports.
- Selection and file prompts are persisted as `.dsxu/vscode-prompts/*.md`
  artifacts so the CLI can read them through normal source-truth rules.

## Install From Source

From the DSXU checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-vscode-extension.ps1
```

On macOS, Linux, or WSL:

```bash
bash ./scripts/install-vscode-extension.sh
```

Restart or reload VS Code after copying the extension.
