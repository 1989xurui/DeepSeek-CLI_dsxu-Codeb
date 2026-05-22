# DSXU Fresh Install Windows Smoke - 2026-05-22

Status: PASS_FRESH_INSTALL_WINDOWS_SMOKE

This focused smoke verifies Windows source-install launchers, UTF-8 setup, WSL path detection, README/INSTALL surface, support QR assets, and isolated first-run key setup without storing or printing a real key.

## Static checks

| id | passed | detail |
|---|---:|---|
| workspace-identity-root-files | true | smoke root has package.json, Windows launchers, and DSXU product entrypoint: D:\DSXU-code-publish-wsl-fix |
| launcher-path-drift-no-hardcoded-repo | true | launchers and installers derive repo root from their own location instead of hard-coded D:/DSXU paths |
| root-install-dispatcher | true | root install.ps1 dispatches Windows install, optional WSL, Windows Terminal policy, and no-launch smoke mode |
| root-shell-install-dispatcher | true | root install.sh dispatches Unix install and points Windows Git Bash users to install.ps1 |
| root-start-cmd-current-dir | true | root Windows launcher delegates to repo-local PowerShell script |
| root-start-cmd-utf8 | true | root Windows launcher switches code page to UTF-8 |
| windows-classic-console-interactive-block | true | Windows launchers relaunch trusted terminals or block interactive classic-console sessions unless explicitly allowed |
| wsl-launcher-default-distro-current-path | true | WSL launcher delegates to PowerShell for repo truth, distro probing, WT relaunch, and native fallback |
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
| windows-wsl-launcher-disabled-falls-back-to-native-version | true | 0 | 1278 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-wsl-launcher-disabled-falls-back-to-native-version-2026-05-22T12-01-00-185Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-wsl-launcher-disabled-falls-back-to-native-version-2026-05-22T12-01-00-185Z.stderr.log |
| windows-launcher-classic-interactive-blocks-without-wt | true | 2 | 910 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-classic-interactive-blocks-without-wt-2026-05-22T12-01-01-464Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-classic-interactive-blocks-without-wt-2026-05-22T12-01-01-464Z.stderr.log |
| windows-product-entrypoint-classic-interactive-blocks | true | 2 | 109 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-product-entrypoint-classic-interactive-blocks-2026-05-22T12-01-02-374Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-product-entrypoint-classic-interactive-blocks-2026-05-22T12-01-02-374Z.stderr.log |
| windows-launcher-version | true | 0 | 790 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T12-01-02-483Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-version-2026-05-22T12-01-02-483Z.stderr.log |
| windows-launcher-missing-key-status | true | 1 | 2337 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T12-01-03-274Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-missing-key-status-2026-05-22T12-01-03-274Z.stderr.log |
| windows-launcher-key-stdin | true | 0 | 2180 | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T12-01-05-611Z.stdout.log | D:\DSXU-code-publish-wsl-fix\.dsxu\trace\fresh-install-windows-smoke\windows-launcher-key-stdin-2026-05-22T12-01-05-611Z.stderr.log |
