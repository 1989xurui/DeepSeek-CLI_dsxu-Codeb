# DSXU Fresh Install Windows Smoke - 2026-05-22

Status: PASS_FRESH_INSTALL_WINDOWS_SMOKE

This focused smoke verifies Windows source-install launchers, UTF-8 setup, WSL path detection, README/INSTALL surface, and isolated first-run key setup without storing or printing a real key.

## Static checks

| id | passed | detail |
|---|---:|---|
| root-install-dispatcher | true | root install.ps1 dispatches Windows install and points non-Windows users to install.sh |
| root-shell-install-dispatcher | true | root install.sh dispatches Unix install and points Windows Git Bash users to install.ps1 |
| root-start-cmd-current-dir | true | root Windows launcher delegates to repo-local PowerShell script |
| root-start-cmd-utf8 | true | root Windows launcher switches code page to UTF-8 |
| wsl-launcher-autodetect | true | WSL launcher auto-detects distro and converts the current repo path |
| wsl-inner-launcher-current-dir | true | WSL inner launcher resolves repo from its own location |
| powershell-launcher-utf8-bun | true | PowerShell launcher owns UTF-8 setup and DSXU product entrypoint |
| windows-installer-desktop-path-shim | true | Windows installer creates desktop shortcut, WSL option, and user PATH shim |
| unix-installer-shims | true | Unix/WSL installer creates command shim and WSL desktop command when available |
| install-doc-bilingual-first-run | true | INSTALL.md covers bilingual install, encoding, and first-run key setup |
| readme-install-surface | true | README files expose install, first-run, desktop, and encoding guidance |
| package-script-windows-smoke | true | package.json exposes the Windows install smoke command |

## Command checks

| id | passed | exitCode | durationMs | stdout | stderr |
|---|---:|---:|---:|---|---|
| windows-launcher-version | true | 0 | 1739 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T04-43-45-655Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T04-43-45-655Z.stderr.log |
| windows-launcher-missing-key-status | true | 1 | 2966 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T04-43-47-394Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T04-43-47-394Z.stderr.log |
| windows-launcher-key-stdin | true | 0 | 2883 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T04-43-50-361Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T04-43-50-361Z.stderr.log |
