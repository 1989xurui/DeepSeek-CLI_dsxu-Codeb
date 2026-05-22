# DSXU Reasonix DeepSeek Absorption Gate - 20260517

Status: `RDX_ACCEPTANCE_GATE_PASS_READY_FOR_REAL_WINDOW`

This evidence pack records the first V26 Reasonix execution packet. It is an acceptance gate only: no runtime path, provider, TUI, MCP/Skill registry, Tool Gate, or query loop is replaced.

## Metrics

| metric | state | value | evidence |
| --- | --- | --- | --- |
| `cacheHitRatePct` | `measured` | 66.8 percent | public challenge ablation: cacheHitRatePct 45.5->66.8 |
| `toolResultChars` | `measured` | 0 chars | public challenge ablation: toolResultChars 316381->0 |
| `tuiRenderResizeLatencyMs` | `measured` | 1102 ms | RDX-F real TUI PTY resize subset passed 3/3 scenarios from \\wsl.localhost\Ubuntu\home\xurui\.dsxu\trace\v18-tui; max resize-sequence latency 1102ms |
| `wallClockMs` | `measured` | 59263 ms | DeepSeek runtime hard engineering benchmark deepseek-route-cost-cache: raw score 60 -> DSXU score 100, DSXU wall-clock 59263ms, trace .dsxu/trace/hard-engineering-benchmark/deepseek-route-cost-cache-dsxu-2026-05-17T13-57-40-350Z.jsonl |
| `proAdmissionCount` | `measured` | 0 count | current RDX-A gate makes no Pro admission; future RDX-D must add ledger evidence |
| `artifactLogSizeBytes` | `measured` | 37414 bytes | RDX-F real TUI trace/transcript/lifecycle artifacts for 3 scenarios from \\wsl.localhost\Ubuntu\home\xurui\.dsxu\trace\v18-tui |

## Packets

| packet | owner | status | next action |
| --- | --- | --- | --- |
| `RDX-CACHE-01` | prompt-prefix-cache-builder / query-loop evidence | `implemented_baseline` | promote this baseline into drift-reason contract during RDX-E |
| `RDX-CACHE-02` | Context / recovery / compact owner | `implemented_baseline` | carry context pressure proof into RDX-F live window and release evidence |
| `RDX-CACHE-03` | DeepSeek adapter / history healing | `implemented_baseline` | verify in RDX-F live DeepSeek request trajectory |
| `RDX-CACHE-04` | Tool result storage / microCompact | `implemented_baseline` | measure artifact/log size and cache effect during RDX-F real window |
| `RDX-CACHE-05` | DeepSeek API transport owner | `implemented_baseline` | wire live retry telemetry into trajectory before public benchmark claim |
| `RDX-TOOL-01` | Tool schema adapter / DeepSeek adapter | `implemented_baseline` | carry streaming/non-stream tool schema smoke into RDX-F real window |
| `RDX-TOOL-02` | DeepSeek adapter extraction path | `implemented_baseline` | carry bounded scavenge through RDX-B performance smoke and Tool Gate integration |
| `RDX-TOOL-03` | DeepSeek adapter / schema validator | `implemented_baseline` | add unrecoverable JSON fail-closed smoke before public claim |
| `RDX-TOOL-04` | query-loop gate / Tool Gate state | `implemented_baseline` | carry storm repair signal into RDX-D Pro admission ledger |
| `RDX-TOOL-05` | DeepSeek cost router / trajectory store | `implemented_baseline` | wire ledger events into DeepSeek trajectory during live route execution |

## Guards


## Next Packets

- RDX-B adapter repair
- RDX-C query/tool gate
- RDX-D route/cost admission
- RDX-E cache hardening
- RDX-F real window + benchmark
