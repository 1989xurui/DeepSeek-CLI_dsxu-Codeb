# DSXU Fresh Install Windows Smoke - 2026-05-22

Status: PASS_FRESH_INSTALL_WINDOWS_SMOKE

This focused smoke verifies Windows source-install launchers, UTF-8 setup, WSL path detection, README/INSTALL surface, support QR assets, and isolated first-run key setup without storing or printing a real key.

## Static checks

| id | passed | detail |
|---|---:|---|
| root-install-dispatcher | true | root install.ps1 dispatches Windows install, optional WSL, Windows Terminal policy, and no-launch smoke mode |
| root-shell-install-dispatcher | true | root install.sh dispatches Unix install and points Windows Git Bash users to install.ps1 |
| root-start-cmd-current-dir | true | root Windows launcher delegates to repo-local PowerShell script |
| root-start-cmd-utf8 | true | root Windows launcher switches code page to UTF-8 |
| windows-classic-console-interactive-block | true | Windows launchers relaunch trusted terminals or block interactive classic-console sessions unless explicitly allowed |
| wsl-launcher-default-distro-current-path | true | WSL launcher uses the default distro, converts the current repo path on Windows, and avoids nested Windows Terminal launches |
| wsl-inner-launcher-current-dir | true | WSL inner launcher resolves repo from its own location |
| powershell-launcher-utf8-bun | true | PowerShell launcher owns UTF-8 setup and DSXU product entrypoint |
| windows-installer-desktop-path-shim | true | Windows installer creates native desktop shortcut, optional WSL path, user PATH shim, Windows Terminal path, and auto-opens CLI |
| windows-wsl-optional-fallback | true | WSL shortcut is optional by default and WSL launcher falls back to native DSXU when WSL is unavailable |
| unix-installer-shims | true | Unix/WSL installer creates command shim and WSL desktop command when available |
| install-doc-bilingual-first-run | true | INSTALL.md covers bilingual install, auto-open, optional WSL, encoding, and first-run key setup |
| readme-install-surface | true | README files expose install, auto-open, first-run, desktop, and encoding guidance |
| readme-support-surface | true | README files expose the support/friend section with fixed QR asset paths |
| readme-support-qr-assets | true | support QR image assets exist and are not empty placeholders |
| package-script-windows-smoke | true | package.json exposes the Windows install smoke command |

## Command checks

| id | passed | exitCode | durationMs | stdout | stderr |
|---|---:|---:|---:|---|---|
| windows-launcher-classic-interactive-blocks-without-wt | true | 2 | 659 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-classic-interactive-blocks-without-wt-2026-05-22T10-03-24-871Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-classic-interactive-blocks-without-wt-2026-05-22T10-03-24-871Z.stderr.log |
| windows-product-entrypoint-classic-interactive-blocks | true | 2 | 99 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-product-entrypoint-classic-interactive-blocks-2026-05-22T10-03-25-531Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-product-entrypoint-classic-interactive-blocks-2026-05-22T10-03-25-531Z.stderr.log |
| windows-launcher-version | true | 0 | 695 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T10-03-25-631Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T10-03-25-631Z.stderr.log |
| windows-launcher-missing-key-status | true | 1 | 2078 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T10-03-26-326Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T10-03-26-326Z.stderr.log |
| windows-launcher-key-stdin | true | 0 | 2062 | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T10-03-28-404Z.stdout.log | D:\DSXU-code\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T10-03-28-404Z.stderr.log |
