# DeepSeek Capability Truth for DSXU

Last checked: 2026-05-17

This page records the DeepSeek API capabilities DSXU relies on. It is a release truth document, not a marketing page. If the official API changes, this page and the DSXU route/cost/cache evidence must be refreshed before public release.

## Official Sources

| Capability area | Official source |
|---|---|
| Chat completion request/response shape | https://api-docs.deepseek.com/zh-cn/api/create-chat-completion |
| Thinking mode | https://api-docs.deepseek.com/zh-cn/guides/thinking_mode |
| JSON output | https://api-docs.deepseek.com/zh-cn/guides/json_mode |
| Function calling / tool calling | https://api-docs.deepseek.com/zh-cn/guides/function_calling |
| FIM completion | https://api-docs.deepseek.com/zh-cn/guides/fim_completion |
| Context caching | https://api-docs.deepseek.com/zh-cn/guides/kv_cache |
| Pricing and cache pricing | https://api-docs.deepseek.com/zh-cn/quick_start/pricing |

## DSXU Route Interpretation

| DSXU lane | Default use | Admission boundary |
|---|---|---|
| Flash non-thinking | Ordinary coding, feature work, bugfix, focused verification, documentation cleanup, shell planning. | Default lane. Keep prompts cache-safe and tool outputs bounded. |
| Flash thinking | Ambiguous failure repair, cross-file reasoning, route-risk review, benchmark analysis. | Must have route reason. Do not trigger only because the prompt contains words like review or plan. |
| Flash-MAX | Wider-context or higher-risk engineering tasks where Flash non-thinking is likely to miss dependency, source truth, or recovery requirements. | Needs route/cost/cache trajectory evidence. |
| Pro | High-risk final review, public claim gating, complex multi-owner repair, or repeated Flash failure. | Requires explicit admission reason and evidence. It is not the default DSXU runtime. |
| FIM | Local completion and small edit lane. | Must stay out of the main query loop unless the user explicitly invokes completion/edit behavior. |

## DSXU Capability Mapping

| DeepSeek capability | DSXU owner use |
|---|---|
| Chat completion | Query loop, work-state timeline, tool lifecycle, final report. |
| Thinking mode | Cost router, route reason, failure repair, public claim review. |
| JSON output | Structured final reports, tool/evidence envelopes, release gates. |
| Function calling | DSXU Tool Gate, Permission Gate, tool result packaging. |
| FIM completion | Small local edit/completion lane only. |
| Context caching | Stable prefix, source capsule, tool-result artifact preview, cache/cost trajectory. |

## Cache and Context Rules

- Stable prefix should contain identity, task contract, owner map, route policy, and source capsule anchors.
- Dynamic tail should contain the current step, latest risk, bounded tool preview, and next action.
- Large Read, Bash, Agent, MCP, browser, and test outputs should be stored as artifacts with bounded previews.
- Cache hit rate is an optimization signal, not a public hard pass condition. DSXU should improve it without deleting source truth.
- Prompt-too-long or 413 recovery must preserve source anchors and final evidence; compacted memory is never proof by itself.

## Public Claim Boundary

DSXU may claim DeepSeek-first orchestration and measured workflow evidence only when the evidence exists. DSXU must not claim model capability, external benchmark victory, branded product parity, or fixed percentage capability without paired raw evidence and a published scoring protocol.

