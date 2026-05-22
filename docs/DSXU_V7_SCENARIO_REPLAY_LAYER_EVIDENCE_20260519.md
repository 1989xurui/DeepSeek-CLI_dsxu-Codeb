# DSXU V7 Scenario Replay Layer Evidence - 20260519

- status: `PASS_DSXU_V7_SCENARIO_REPLAY_LAYER_EVIDENCE`

This report converts the V7 scenario replay bank into an execution/readiness evidence queue. Mock/internal/fixture/live/external layers remain separate. It does not run live providers, does not fabricate paired target raw logs, and does not grant public benchmark claims.

## Summary

| metric | value |
|---|---:|
| rows | 300 |
| sourceReplayBankRows | 300 |
| mockRows | 251 |
| mockContractPassRows | 251 |
| internalReadyRows | 0 |
| fixtureMutationReadyRows | 0 |
| liveProviderBlockedRows | 0 |
| externalBenchmarkBlockedRows | 49 |
| missingSourceDocRows | 0 |
| publicBenchmarkClaimAllowedRows | 0 |
| publicClaimReadyRows | 0 |

## Blockers

- none

## First 80 Rows

| id | level | status | local | source | owner |
|---|---|---|---:|---:|---|
| V7-RP-0001 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0002 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0003 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0004 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0005 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0006 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0007 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0008 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0009 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0010 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0011 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0012 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0013 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0014 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0015 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0016 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0017 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0018 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0019 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0020 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0021 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0022 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0023 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0024 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0025 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0026 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0027 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0028 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0029 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0030 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0031 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0032 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0033 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0034 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0035 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0036 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0037 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0038 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0039 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0040 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0041 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0042 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0043 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0044 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0045 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0046 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0047 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0048 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0049 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0050 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0051 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0052 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0053 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0054 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0055 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0056 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0057 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0058 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0059 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0060 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0061 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0062 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0063 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0064 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0065 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0066 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0067 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0068 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0069 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0070 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0071 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0072 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0073 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0074 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0075 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0076 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0077 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Scenario Replay Bank |
| V7-RP-0078 | external-benchmark | BLOCKED_NEEDS_EXTERNAL_PAIRED_RAW | false | true | Evidence / Benchmark Owner |
| V7-RP-0079 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
| V7-RP-0080 | mock | PASS_MOCK_REPLAY_CONTRACT | true | true | Release Claim Binder |
