# DSXU V10 Final Long Task Replay

Status: PASS_V10_FINAL_LONG_TASK_REPLAY

Source status: PASS_V8_LONG_TASK_LEDGER_REPLAY

Projection status: recoverable

Runtime proof: PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION

## Compact TUI Lines

- LongTask: task=v8-long-task-ledger-replay session=session-v8-ledger
- State: plan | completed=false | events=10
- Resume: plan
- Memory: task=4 source=4 change=1 failure=4 claim=8
- Stall: repeated_verification_failure -> replan | confidence=85%
- [task_contract] long_task via V8 tool window | owner=Query Loop / PlanGraph / Tool Gate | evidence=taskType:long_task,visibleTools:Agent|Bash|RunNativeTest
- [source_evidence] read V8 owner modules | owner=Source Truth | evidence=src/dsxu/engine/action-contract.ts,src/dsxu/engine/tool-window-policy-v8.ts
- [tool] focused V8 script/test execution planned | owner=Tool Gate | evidence=tool:Bash,bounded-output:true
- [verification] Verification failed (blocking) | owner=VerificationKernel | evidence=schema:VerifySummary,policy:blocking,passed:false
- [recovery] Localized feedback envelope ready (1 findings) | owner=VerificationKernel / Recovery / GearBox | evidence=localizedFeedback:ready,findingCount:1,localizedFiles:0
- [stall] repeated_verification_failure -> replan | owner=Recovery / GearBox | evidence=schema:VerifySummary,policy:blocking,passed:false
- [recovery] split V8 final gates into reachability, CN replay, ledger replay, and provider smoke | owner=Recovery / GearBox | evidence=recovery:split-owner-gates
- [evidence] public claim remains blocked until paired raw evidence and clean export exist | owner=Evidence / Release Claim Binder | evidence=publicClaimAllowed:false,cleanExportArtifact:not-created
- Next: read the failing assertion, change strategy, and rerun focused verification

Blockers: none

Rule: V10 final long-task replay reuses the V8 ledger owner output and only upgrades evidence aggregation. It is not a new execution runtime.
