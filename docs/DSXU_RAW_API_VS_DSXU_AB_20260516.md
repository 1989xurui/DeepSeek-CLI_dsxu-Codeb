# DSXU Raw DeepSeek API vs DSXU A/B - 2026-05-16

Status: `PASS_DSXU_WORKFLOW_LIFT_OVER_RAW_API_BASELINE`

This report compares a raw DeepSeek chat-completions baseline with the DSXU tool/edit/test workflow on the same isolated fixture tasks. It proves workflow lift, not model superiority.

## Summary

| totalTasks | rawAverageScore | dsxuAverageScore | scoreLift | rawPassRatePct | dsxuPassRatePct | passRateLiftPct | rawTotalCostUSD | dsxuTotalCostUSD | dsxuToolCalls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15 | 85 | 99.3 | 14.3 | 0 | 100 | 100 | 0.0013314728 | 0.0955018232 | 103 |

## Task Results

| id | rawScore | dsxuScore | rawPass | dsxuPass | dsxuFinalTest | dsxuTools | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| route-policy-flash-first | 85 | 100 | false | true | true | Bash:2; Glob:1; Read:3; Edit:1 | flash max before pro; failed flash can use pro; tests pass |
| terminal-result-pack | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | bounded preview; full log artifact; failure type; recovery action |
| claim-boundary-guard | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | cost claim allowed with no regression; public90 blocked; external victory blocked |
| source-capsule-budget | 85 | 100 | false | true | true | Bash:2; Glob:1; Read:3; Edit:1 | bounded excerpt; source hash; range read fallback; no raw full content |
| permission-gate-decision | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | delete blocked; shell approval; secret write approval; safe read allowed |
| failure-repair-taxonomy | 85 | 100 | false | true | true | Bash:2; Glob:1; Read:3; Edit:1 | timeout repair; missing dependency repair; assertion repair; command failure repair |
| agent-evidence-envelope | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | summary only; unique changed files; conflict detection; tests passed |
| mcp-skill-registry | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:2 | primary priority; secondary fallback; permission passthrough; adapter boundary |
| json-schema-repair | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | fenced JSON extraction; trailing comma repair; required field errors; no throw |
| workspace-hygiene-classifier | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | source owner; evidence excluded; release artifact; permission residue; delete candidate |
| route-intent-lock | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | workflow lock; model lock; thinking lock; explicit admission |
| read-fallback-governor | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | grep first; range read; artifact preview; small read allowed |
| secret-release-redaction | 85 | 100 | false | true | true | Glob:1; Read:5; Edit:1; Bash:2 | DeepSeek key redacted; Authorization redacted; safe summary preserved |
| cost-quality-pareto | 85 | 90 | false | true | true | Bash:3; Glob:1; Read:6; Edit:2 | no score regression; cost reduction pct; cache lift pct; internal evidence boundary |
| visible-state-projection | 85 | 100 | false | true | true | Glob:1; Read:3; Edit:1; Bash:1 | single event source; TUI projection; CLI projection; final report projection |

## Claim Boundary

- publicClaimAllowed: `true`
- externalSuperiorityAllowed: `false`
- public90Allowed: `false`
- chartPath: `docs/assets/dsxu-raw-api-vs-dsxu-ab.svg`

Allowed claim: DSXU adds measurable tool/edit/test workflow lift over a raw DeepSeek API plan-only baseline on these fixtures.

Blocked claims: external benchmark victory, model superiority, public 90/95 ability, and any claim that raw internal fixtures equal public benchmark scores.