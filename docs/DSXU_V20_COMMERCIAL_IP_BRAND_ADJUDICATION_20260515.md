# DSXU V20 Commercial / IP / Brand Adjudication - 2026-05-15

## 目标

本轮不是继续做扫词游戏，而是按 V20 原侧目标把商业、IP、品牌风险落到 owner 结论：

- DSXU 产品文案、skill 文案、agent 文案、release 表达必须使用 DSXU / DeepSeek / provider-neutral 口径。
- 第三方产品名只能出现在内部测试、迁移证据、技术平台标识、安全检测或 vendor 法律信息里。
- 不能把生态画像、外部品牌、外部模型或旧 provider runtime 写成 DSXU 的产品能力承诺。

## 本轮代码收口

已直接改掉真实产品面残留：

| 类别 | 处理 |
|---|---|
| API / skill / guide agent 文案 | `OpenAI-compatible` 改为 `chat-completions-compatible` 或 `DSXU/DeepSeek API`。 |
| public comparison contract | `GPT/Codex/Gemini/Aider/Cline` 改为 `external coding-model runners under identical constraints`。 |
| terminal setup product copy | 不再向用户展示特定第三方终端品牌；只保留 CSI u / Kitty keyboard 能力描述。 |
| toolchain selfcheck 文案 | `Codex app resource path` 改为 `external app resource path`。 |
| source maps | 移除 6 个内嵌 `sourceMappingURL` / `sourcesContent`，避免旧来源文案继续泄漏到源码扫描。 |
| provider transport comments | DeepSeek 主 owner 表述保留，外部/local fallback 改为显式 operator-gated technical boundary。 |

## 生成证据

- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_20260515.csv`
- `docs/generated/DSXU_V20_COMMERCIAL_IP_BRAND_ADJUDICATION_SUMMARY_20260515.json`

当前 source adjudication：

| 项 | 数量 |
|---|---:|
| scanned source rows | 98 |
| active review-required rows | 0 |
| product copy neutralized this round | 15 |
| inline source maps removed | 6 |

保留项不是第二套 runtime：

| Disposition | 含义 |
|---|---|
| `KEEP_INTERNAL_ENV_OR_PROTOCOL_IDENTIFIER` | `OPENAI_API_KEY`、`allowOpenAIFallback`、`allowOllamaFallback` 等是显式 fallback/env/protocol 标识，默认不注册第二 provider runtime。 |
| `ALLOW_RELEASE_EXCLUDED_TEST_EVIDENCE` | provider / local fallback 命名留在测试里，用来证明显式 gate，不进入 public product claim。 |
| `KEEP_INTERNAL_IDENTIFIER_PRODUCT_COPY_NEUTRALIZED` | `WarpTerminal` / bundle id 只用于平台检测，产品 copy 已改成能力中性描述。 |
| `KEEP_GENERIC_GIT_OPERATION` | `cherry-pick` 是 Git 命令原语，不是产品品牌引用。 |
| `KEEP_SAFETY_GUARD` | copyright 相关文字是 WebFetch 安全边界或 MCP 工具名，不是商业 claim。 |
| `KEEP_SECURITY_DETECTOR` | secret scanner 可以命名 provider token 类型以保护用户。 |

## Gate 裁决

`COMMERCIAL_IP_BRAND_GATE = ADJUDICATED_ACTIVE_BLOCKERS_0`

这不是法律意见，也不是最终 release PASS。vendor binary notices、license notice、package metadata、final release docs 仍必须在 final preflight / release closure 中复核。但就当前 V20 源码和公开产品文案而言，本 gate 不再阻断 real-gap acceptance 与后续 owner/Git 收口。

## 后续边界

1. 不能把 AionUi / Cherry / Warp / browser-use / Claude Code 生态画像写成 DSXU 内置依赖或产品承诺。
2. 不能把 provider fallback 写成默认 DSXU 模型能力；只能通过显式 operator gate。
3. final tests 和 clean export 仍必须等 Owner/Git、deletion mutation、ACL residue、real-gap acceptance 和 release preflight 通过后执行。
