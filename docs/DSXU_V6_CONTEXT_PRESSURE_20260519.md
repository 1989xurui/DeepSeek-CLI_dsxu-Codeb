# DSXU V6 Context Pressure Report

- status: `PASS_V6_CONTEXT_PRESSURE_REPORT`
- levels: `70,85,95,99`
- cache evidence: `CACHE_PREFIX_READY`
- large tool result artifacted: `true`

## Rows

| level | bucket | risk | action | cache policy | blockers |
| --- | --- | --- | --- | --- | --- |
| 70 | 70-84 | medium | checkpoint_and_trim_dynamic_tail | keep_stable_prefix_fixed_and_move_volatiles_to_artifacts | none |
| 85 | 85-94 | high | snapshot_then_context_hygiene | keep_goal_plan_route_and_source_anchors_stable | none |
| 95 | 95-98 | critical | source_capsule_then_context_hygiene | freeze_route_tools_and_dynamic_tail_before_retry | none |
| 99 | >=99 | emergency | prompt_too_long_recovery_or_source_truth_snapshot | preserve_stable_prefix_and_send_only_recovery_delta | none |

## Blockers

- none
