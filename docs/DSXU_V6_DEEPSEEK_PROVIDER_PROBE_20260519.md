# DSXU V6 DeepSeek Provider Probe - 20260519

状态：PASS_V6_DEEPSEEK_PROVIDER_CONTRACT

模式：live

边界：Live DeepSeek Flash provider probe. It proves basic API availability, response marker, usage/cache/cost fields for one fixed low-risk probe only. It is not a benchmark, not a full tool-call live replay, and not a public model-quality claim.

| check | status | evidence |
|---|---|---|
| live-api-key | PASS | DEEPSEEK_API_KEY=set:redacted |
| live-flash-response | PASS | model=deepseek-v4-flash<br>expected marker returned |
| live-usage-output-tokens | PASS | output_tokens=8 |
| live-cache-usage-fields | PASS | cache_hit=0<br>cache_miss=25 |
| live-cost-evidence | PASS | estimated_cost_usd=0.000005740000000000001 |

## Blockers

- none
