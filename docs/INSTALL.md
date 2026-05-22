# DSXU Code Install Guide / 安装指南

This guide is the release-facing source install path for DSXU Code. It keeps one product runtime: all launchers enter `src/entrypoints/dsxu-code.tsx`; installers only prepare the terminal, dependencies, PATH shim, desktop shortcut, and first-run setup.

本指南面向 GitHub 开源下载用户。安装器只负责终端编码、依赖、PATH shim、桌面快捷方式和首次配置；真正运行仍进入同一个 DSXU 产品入口 `src/entrypoints/dsxu-code.tsx`，不会新增第二套主链。

## Requirements / 环境要求

- Git.
- Bun 1.3+.
- Windows 10/11 with Windows Terminal or PowerShell 5.1+.
- Optional: WSL2 with Ubuntu or another Linux distro.
- macOS or Linux terminal for non-Windows users.
- A DeepSeek API key for real model calls.

## One-Command Install / 一键安装

Windows users can run the root installer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Windows 用户下载后优先运行根安装器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

On macOS, Linux, or WSL:

```bash
bash ./install.sh
```

Optional non-mutating help:

```bash
bash ./install.sh --help
```

The root PowerShell installer detects Windows and delegates to `scripts/install-windows.ps1`. Non-Windows PowerShell prints the Unix installer command instead of trying to run a Windows path. The root shell installer detects Unix-like systems and delegates to `scripts/install.sh`; Git Bash/MSYS on Windows points users back to `install.ps1` so desktop shortcuts and UTF-8 launchers are created correctly.

根 PowerShell 安装器会在 Windows 下自动调用 `scripts/install-windows.ps1`；如果在非 Windows PowerShell 里运行，它会提示改用 Unix installer，不会乱跑 Windows 路径。根 shell 安装器会在 macOS/Linux/WSL 下自动调用 `scripts/install.sh`；如果用户在 Windows Git Bash/MSYS 里运行，会提示回到 `install.ps1`，确保能创建桌面快捷方式和 UTF-8 启动器。

## Windows One-Command Install / Windows 一键安装

Equivalent direct Windows installer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

The installer:

- switches the install session to UTF-8;
- verifies Bun is available;
- runs `bun install --frozen-lockfile`;
- creates `DSXU Code.lnk` on the desktop for the native Windows launch path;
- creates the optional `DSXU Code WSL.lnk` desktop shortcut only when WSL is explicitly requested or a WSL distro is already detected;
- creates `%LOCALAPPDATA%\DSXU Code\bin\dsxu-code.cmd`;
- adds that shim directory to the user PATH if missing;
- opens the DSXU CLI in a UTF-8 terminal so first-time users immediately see the welcome and DeepSeek key setup flow.

For most Windows users, this is the recommended default: install once on Windows, then launch `DSXU Code` from the desktop. The installer prefers Windows Terminal and, when it is missing, tries to install Microsoft Windows Terminal with `winget`. Interactive Chinese/Unicode sessions are allowed only in Windows Terminal or the VS Code terminal; classic cmd/PowerShell is limited to non-interactive commands or explicit English/ASCII emergency mode. DSXU does not force every Windows user into WSL and does not create a WSL desktop shortcut on machines without a ready distro unless the user explicitly asks for it.

Optional WSL bootstrap:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -InstallWsl
```

This checks for an existing WSL distro. If none exists, it runs `wsl --install -d Ubuntu`. WSL install may require administrator approval, Microsoft Store access, a reboot, or first-run Linux user setup, so DSXU does not silently force it by default.

If WSL is already configured and you only want to add the optional WSL shortcut:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoDependencies -CreateWslShortcut
```

For CI or smoke tests that must not open an interactive terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoLaunch
```

If an enterprise image blocks automatic Windows Terminal installation:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoWindowsTerminalInstall
```

This keeps install deterministic. For interactive Chinese/Unicode UI, install Windows Terminal and rerun the desktop shortcut. Classic console is only for non-interactive commands or explicit English/ASCII emergency sessions.

安装脚本会：

- 切换 UTF-8，避免中文和边框乱码；
- 检查 Bun；
- 执行 `bun install --frozen-lockfile`；
- 创建 Windows 原生桌面快捷方式 `DSXU Code.lnk`；
- 只有在用户明确要求或已经检测到 WSL distro 时，才创建可选 WSL 桌面快捷方式 `DSXU Code WSL.lnk`；
- 创建 `%LOCALAPPDATA%\DSXU Code\bin\dsxu-code.cmd`；
- 如果 PATH 缺失，会把该 shim 目录加入用户 PATH；
- 安装完成后自动打开 DSXU CLI 界面，让首次用户直接看到欢迎页和 DeepSeek key 配置流程。

对大部分 Windows 用户来说，推荐默认方案就是：在 Windows 一键安装，然后从桌面 `DSXU Code` 进入。安装器会优先使用 Windows Terminal；如果缺失，会尝试通过 `winget` 安装 Microsoft Windows Terminal。中文/Unicode 交互只允许在 Windows Terminal 或 VS Code terminal 中运行；旧 cmd/PowerShell 只用于非交互命令或显式英文/ASCII 应急模式。没有 WSL distro 的机器不会默认创建 WSL 桌面入口，避免用户误点后停在 WSL 配置提示。

如果希望安装器顺手检查或安装 WSL：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -InstallWsl
```

该开关会先检测已有 WSL distro；如果没有，就执行 `wsl --install -d Ubuntu`。WSL 安装可能需要管理员权限、Microsoft Store、重启或首次 Linux 用户初始化，所以 DSXU 不会默认静默强装。

如果 WSL 已经配置好，只想补一个可选 WSL 桌面入口：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoDependencies -CreateWslShortcut
```

如果是 CI 或安装 smoke 测试，不希望安装后弹出交互终端：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoLaunch
```

如果企业镜像不允许自动安装 Windows Terminal：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -NoWindowsTerminalInstall
```

安装仍可完成，但中文/Unicode 交互需要 Windows Terminal 或 VS Code terminal。旧控制台只用于非交互命令或显式英文/ASCII 应急模式。

If Bun is not installed, install it first:

```powershell
powershell -c "irm https://bun.sh/install.ps1 | iex"
```

Then reopen Windows Terminal and rerun the DSXU installer.

## Windows Launchers / Windows 启动方式

Recommended:

```powershell
.\Start-DSXU-Code.cmd
```

or click `DSXU Code` on the desktop after installation.

This launcher resolves the current repository path automatically. It no longer hardcodes `D:\DSXU-code`.

## VS Code Adapter / VS Code 插件适配层

DSXU ships a source-installable VS Code adapter in `integrations/vscode`. It is intentionally an adapter: VS Code owns editor commands, selected-text handoff, status-bar UX, and terminal launch; DSXU still owns the single CLI mainline, DeepSeek routing, Tool Gate, Permission Gate, recovery, cost/cache evidence, and final reports.

Windows install:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-vscode-extension.ps1
```

or during source install:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -InstallVsCodeExtension
```

macOS / Linux / WSL install:

```bash
bash ./scripts/install-vscode-extension.sh
```

or:

```bash
bash ./install.sh --install-vscode-extension
```

After reloading VS Code, open the command palette and run:

- `DSXU Code: Open`
- `DSXU Code: Ask About Selection`
- `DSXU Code: Explain Current File`
- `DSXU Code: Configure DeepSeek Key`
- `DSXU Code: Run Doctor`

If your opened workspace is not the DSXU checkout, set `dsxuCode.repoPath` to the DSXU repository path. Selection prompts are written to `.dsxu/vscode-prompts/*.md` and then handed to DSXU CLI so normal source-truth, permission, and evidence rules still apply.

Smoke check:

```bash
bun run ide:vscode-smoke
```

### WSL launcher / WSL 启动

```powershell
.\Start-DSXU-Code-WSL.cmd
```

The WSL launcher:

- detects `wsl.exe`;
- detects the first configured distro or uses `DSXU_WSL_DISTRO`;
- converts the current Windows checkout path into a WSL `/mnt/...` path;
- verifies that this downloaded checkout is reachable inside WSL before starting DSXU;
- opens Windows Terminal when available;
- falls back to the Windows native launcher if WSL is missing, not initialized, or cannot reach the checkout.

If WSL is not installed, run:

```powershell
wsl --install -d Ubuntu
```

After the first WSL setup finishes, rerun `Start-DSXU-Code-WSL.cmd`.

## macOS / Linux / WSL Install

```bash
bash ./install.sh
```

Help without installing:

```bash
bash ./install.sh --help
```

The script runs `bun install --frozen-lockfile`, creates `~/.local/bin/dsxu-code`, and creates a desktop launcher when the platform exposes a desktop folder. In WSL, it also creates a Windows desktop command when possible.

## First-Run DeepSeek Key Setup / 首次配置 DeepSeek key

Do not put real keys in the repository.

On first interactive launch, if no key is configured, DSXU opens the local model-access setup screen. Paste your DeepSeek key there.

You can also configure from a terminal:

```bash
bun ./src/entrypoints/dsxu-code.tsx auth login
```

For scripts:

```bash
printf "sk-..." | bun ./src/entrypoints/dsxu-code.tsx auth login --api-key-stdin
```

Supported direct key sources:

- DSXU-managed local key from `/login` or `auth login`;
- `DSXU_API_KEY`;
- `DEEPSEEK_API_KEY`;
- `DSXU_DEEPSEEK_API_KEY`;
- explicit local gateway such as `LITELLM_BASE_URL`.

## Manual Source Install / 手动安装

```bash
git clone https://github.com/1989xurui/DeepSeek-CLI_dsxu-Codeb.git
cd DeepSeek-CLI_dsxu-Codeb
bun install --frozen-lockfile
bun run dsxu-code
```

If you use PowerShell directly, prefer:

```powershell
.\Start-DSXU-Code.cmd
```

instead of manually editing `$env:Path` each time.

## Mojibake / Garbled Text Fix / 乱码修复

Most Windows garbling comes from legacy console code pages, not from DSXU itself. Use one of these supported launch paths:

- Windows Terminal + `Start-DSXU-Code.cmd`;
- desktop shortcut created by `scripts\install-windows.ps1`;
- WSL shortcut created by the same installer.

The Windows launcher sets:

- `chcp 65001`;
- .NET console input/output encoding to UTF-8;
- `LANG=zh_CN.UTF-8`;
- `LC_ALL=zh_CN.UTF-8`;
- color-capable terminal defaults.
- classic console blocking for interactive Chinese/Unicode sessions unless the user explicitly chooses an English/ASCII emergency path.

If an old terminal still renders poorly, open Windows Terminal and launch DSXU from there.

## Smoke Checks / 安装验证

Focused Windows source-install smoke:

```bash
bun run release:fresh-install-windows-smoke
```

General release fresh-install smoke:

```bash
bun run release:fresh-install-smoke
```

Basic product checks:

```bash
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx --version
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx --help
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx auth status --text
```

These are install smokes. They do not replace full release testing.
