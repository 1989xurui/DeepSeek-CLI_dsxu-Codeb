# DSXU Code Install Guide

本文件是 V20 GitHub 开源发布产品化入口之一。它说明如何在不引入第二套入口的前提下安装和启动 DSXU Code。

## Requirements

- Node.js 20+。
- npm 10+。
- Bun 1.3+，当前脚本和测试默认使用 Bun。
- Git。
- Windows PowerShell、WSL、macOS Terminal 或 Linux shell。
- DeepSeek API key，或显式配置的 DSXU model gateway。

## Source Install

```bash
git clone <your-dsxu-repo-url>
cd DSXU-code
npm install
cp .env.example .env
```

编辑 `.env`：

```env
DSXU_CODE_MODE=1
DSXU_MODEL_PROVIDER=deepseek
DSXU_MODEL_GATEWAY=direct
DSXU_API_KEY=your_key_here
DSXU_MODEL=deepseek-v4-flash
```

启动：

```bash
bun run dsxu-code
```

Windows 可直接运行：

```powershell
.\Start-DSXU-Code.cmd
```

WSL 启动：

```powershell
.\Start-DSXU-Code-WSL.cmd
```

## Binary / npm Status

V20 当前仍是 release-blocked 状态。`package.json` 仍标记为 `private: true`，表示还没有进入 npm 发布。GitHub Release、npm wrapper、checksum、clean export 必须等 `docs/RELEASE_RUNBOOK.md` 的 release gates 全部 PASS 后才能执行。

## China Network Notes

- 依赖安装可以使用企业 npm mirror，但不要把 mirror 配置写死进源码。
- DeepSeek API base URL 应通过 `.env` 或 DSXU config 显式配置。
- 不要把 OpenAI/Ollama/provider-migration fallback 当成默认 DSXU provider runtime。

## Smoke Checks

```bash
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx --version
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx -p "/help" --output-format json
bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"
```

这些是安装 smoke，不是 V20 final comprehensive tests。
