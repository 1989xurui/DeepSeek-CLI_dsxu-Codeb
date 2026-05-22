# DSXU V6 Live Tool-Call Replay

- status: `PASS_V6_LIVE_TOOL_CALL_REPLAY`
- mode: `live`
- owner: `DeepSeek Provider / Tool Protocol`
- claimBoundary: This proves one live DeepSeek Flash strict tool-call round trip plus local tool-result replay and fallback blocking evidence. It is not an external benchmark or public 90% model-quality claim.

## Metrics

| metric | value |
|---|---:|
| requestCount | 2 |
| totalInputTokens | 524 |
| totalOutputTokens | 78 |
| totalCacheHitTokens | 384 |
| totalCacheMissTokens | 140 |
| totalEstimatedCostUsd | 0.000042515 |

## Checks

| id | status | evidence |
|---|---|---|
| live-api-key | PASS | DEEPSEEK_API_KEY=set:redacted |
| live-strict-tool-call-returned | PASS | toolName=dsxu_live_echo<br>toolCallId=call_00_Mgsrb9ix4TcO0dRgCzhk0390<br>schemaPath=strict_schema |
| live-tool-result-replay-final | PASS | final marker returned after tool result replay |
| fallback-observable-not-strict | PASS | schemaPath=xml_fallback<br>DeepSeek response used XML/simple-tag fallback instead of strict function call |
| fallback-hidden-tool-blocked | PASS | MCPDocs fallback produced no allowed tool calls |

## Blockers

- none
