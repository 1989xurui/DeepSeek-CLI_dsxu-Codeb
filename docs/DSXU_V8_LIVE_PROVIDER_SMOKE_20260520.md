# DSXU V8 Live Provider Smoke

Status: PASS_V8_PROVIDER_SMOKE_CONTRACT

Mode: dry-run

| check | status | evidence |
|---|---|---|
| model | PASS | model=deepseek-v4-flash |
| thinking | PASS | thinking=enabled |
| reasoning-content | PASS | assistant.reasoning_content present |
| tool-round-trip | PASS | assistant.tool_calls and tool result are projected |
| usage-stream | PASS | include_usage=true |
| strict-tool-schema | PASS | additionalProperties=false |

Rule: This smoke validates DeepSeek API contract shape and optional one-call Flash availability only. It is not a benchmark, not a model-quality claim, and not a public 90/95 claim.
