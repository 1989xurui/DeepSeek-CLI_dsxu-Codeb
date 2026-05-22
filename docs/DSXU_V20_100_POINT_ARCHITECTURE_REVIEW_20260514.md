# DSXU V20 100-Point Architecture Review

Date: 2026-05-14

Scope: src/dsxu plus active production imports that still enter DSXU runtime, tool, permission, MCP, skill, provider, agent, evaluation, and release surfaces.

Target: V18+V19 closure becomes product-grade DSXU V20. The standard is not "evidence says pass"; the standard is that a senior AI coding system can complete real complex programming tasks with honest state, safe tool control, visible recovery, real UI/TUI operation, and release-grade evaluation.

## Current Verdict

V18/V19 closure is strong as an evidence and release gate baseline, but DSXU is not yet a 100/100 product runtime. The main blockers are runtime composition, tool permission ordering, active legacy/provider imports, P12 comparison semantics, and real operation test coverage.

The next work should be product-mainline refactor first, then real operation tests. Tests prove the behavior; they must not substitute for ownership and design decisions.

## Critical Findings

### A1 Runtime core is still an aggregate bucket

Evidence:

- `src/dsxu/engine/runtime-core.ts` is about 309 KB and acts as a broad runtime/export container.
- The top file block starts as a comment and does not close until line 408, so many apparent imports/exports near the top are not live code.
- `createRuntimeCore` at `src/dsxu/engine/runtime-core.ts:409` still returns simplified/mock surfaces, including mock session/task/memory/LSP and pass/approved verification scores.

Risk:

This lets tests import later utility exports while the named runtime factory does not behave like a real DSXU product composition root. It also hides ownership under one large file.

Required change:

- Split `runtime-core.ts` into named owners: query loop composition, tool lifecycle, permission/tool gate, MCP/skill registry, model routing/cost evidence, agent orchestration, evidence/eval, release gate.
- Replace mock factory returns with real ports or explicit unavailable results.
- Keep `runtime-core.ts` only as a thin composition root that wires owners; no duplicate runtime logic and no broad compatibility holding path.

### A2 Tool execution can happen before real permission/gate evaluation

Evidence:

- `src/dsxu/engine/tool-mainline-runtime-v1.ts:88` calls `tryExecuteMainlineManagedServiceTool` before normal permission/gate flow.
- `src/dsxu/engine/tool-mainline-runtime-v1.ts:101` then assigns `allowed: true` with reason `mainline-managed service tool path`.
- Managed service paths include cron, remote trigger, MCP read/write, workflow, and auth-related operations.
- `src/dsxu/engine/tool-mainline-runtime-v1.ts:114` sends `AgentTool` through a special branch; `src/dsxu/engine/tool-mainline-runtime-v1.ts:126-135` marks it allowed, and `src/dsxu/engine/tool-mainline-runtime-v1.ts:662` returns `isError: false` even when the action is not semantically proven.

Risk:

This violates the V18/V19 principle that all tool execution enters the Tool Gate, adapter, permission bridge, and visible-state projection in a single order. It can also make invalid agent/tool calls look successful.

Required change:

- Permission evaluation must happen before managed-service execution.
- Each managed-service tool must have explicit side-effect metadata and owner.
- Agent lifecycle operations must route through the agent orchestration owner, not through a generic `AgentTool` catch-all.
- Unknown agent actions must fail closed and emit evidence.

### A3 Permission model is too permissive for a high-autonomy coding system

Evidence:

- `src/dsxu/engine/permissions.ts:76-80` classifies broad `npm/npx/yarn/pnpm/bun run/exec` and `node/bun/deno/python` commands as safe by pattern.
- `src/dsxu/engine/permissions.ts:271-272` allows safe-classified Bash immediately.
- `src/dsxu/engine/permissions.ts:277` allows writes with string `startsWith(context.cwd)`.
- `src/dsxu/engine/permissions.ts:324-330` allows confirm-required operations when there is no ask callback.

Risk:

Script runners and interpreters can perform arbitrary writes, network, deletion, process spawn, publishing, or credential reads. String prefix path checks are not enough on Windows. Autonomous mode must not silently convert missing user confirmation into allow.

Required change:

- Treat package script execution and interpreters as guarded unless a trusted script manifest proves scope.
- Resolve and normalize paths before project-boundary checks.
- Missing ask callback should return `needs_confirmation` / blocked visible state, not allow.
- Add evidence for why each Bash/PowerShell command is allowed, denied, or escalated.

### A4 Active production code still imports `src/dsxu/legacy`

Evidence:

Real import scan shows legacy compat imports from active services, tools, and UI components, including:

- `src/services/api/bootstrap.ts`
- `src/services/api/usage.ts`
- `src/services/api/dsxuTransport.ts`
- `src/services/oauth/getOauthProfile.ts`
- `src/services/mcp/*`
- `src/tools/WebSearchTool/WebSearchTool.ts`
- `src/tools/WebFetchTool/utils.ts`
- `src/tools/AgentTool/built-in/statuslineSetup.ts`
- `src/components/PromptInput/PromptInput.tsx`
- `src/components/Settings/Usage.tsx`
- `src/dsxu/engine/context-window-manager-v1.ts`

Risk:

`legacy` is not merely archive/evidence. It is still part of production provider/auth/model/MCP/control-plane behavior. That blocks a clean V20 ownership story.

Required change:

- Create explicit DSXU owners for provider auth, model metadata/context window, MCP protocol/auth, transport, and usage/cost.
- Migrate active imports away from `legacy/*` to those owners.
- Keep old files only as replace/delete candidates or documented external compatibility tests.

### A5 P12 raw comparison can overstate quality when target output is blocked/partial

Evidence:

- `src/dsxu/engine/phase12-raw-comparison-v1.ts:332-335` scores PASS as 1, PARTIAL as 0.5, otherwise 0.
- `src/dsxu/engine/phase12-raw-comparison-v1.ts:659-663` marks a case PASS when raw integrity is present and no critical finding exists.
- `src/dsxu/engine/phase12-raw-comparison-v1.ts:719-725` reports overall PASS if there are enough paired logs and no blocked/partial comparison cases.
- `src/dsxu/engine/phase12-raw-comparison-v1.ts:750` sets `mustNotClaimComparisonWin` only when overall status is not PASS or DSXU has a negative outcome gap.

Risk:

If target-reference logs are real but blocked/partial, DSXU can get positive deltas and the report can say PASS with `mustNotClaimComparisonWin=false`. That is raw input completeness, not quality comparability.

Required change:

- Split P12 into `raw_intake_status`, `pair_integrity_status`, and `quality_comparison_status`.
- Any target blocked/partial pair must keep `mustNotClaimComparisonWin=true` unless the target run is explicitly marked as a valid failure baseline.
- Add target outcome quality redlines separate from missing artifact redlines.

### A6 Tool registry collapses unknown side effects into generic metadata

Evidence:

- `src/dsxu/engine/tool-registry-v1.ts:165-181` infers permission/read-write/side-effect from `runtimeTool.readOnly`.
- `src/dsxu/engine/tool-registry-v1.ts:182` uses failure class `unknown`.
- `src/dsxu/engine/tool-registry-v1.ts:158` has default owner typo `duxu-mainline`.

Risk:

Network, MCP, external integration, local write, and agent lifecycle tools can be under-described. Tool Gate cannot make a high-quality decision from generic side-effect metadata.

Required change:

- Add explicit metadata per tool family and fail closed when side effect is unknown.
- Require owner, permission class, side-effect class, read/write class, recoverability, and evidence sink for every registered tool.

## High-Value Refactor Packages

### V20-R1 Composition Root Split

Goal: Make DSXU runtime structure readable and enforceable.

Actions:

- Extract real runtime composition from `runtime-core.ts`.
- Keep each owner in a separate module with typed ports.
- Delete or mark duplicate runtime construction paths as replace/delete candidates.
- Add import-boundary tests: query loop cannot import legacy/provider internals directly; tools cannot bypass permission owner.

Acceptance:

- No product runtime mock returns from `createRuntimeCore`.
- Runtime composition file is thin and mostly wiring.
- Each owner has one entrypoint and one evidence contract.

### V20-R2 Permission-First Tool Runtime

Goal: No tool side effect before gate.

Actions:

- Move permission/gate evaluation ahead of `tryExecuteMainlineManagedServiceTool`.
- Convert managed service tools to normal registered tools with explicit metadata.
- Reject unknown agent actions.
- Add tests for cron, MCP write, remote trigger, workflow, agent lifecycle, and fallback behavior.

Acceptance:

- Every tool execution has pre-execution permission evidence.
- Guarded/write/external tools cannot run when confirmation is absent.
- Fallback is visible recovery evidence, not silent product routing.

### V20-R3 Legacy Import Absorption

Goal: Remove production reliance on `src/dsxu/legacy`.

Actions:

- Build owner modules for provider auth, model metadata, MCP auth/protocol, transport, usage/cost, and context window.
- Migrate active imports by owner, not by blanket rename.
- Keep behavior-identical legacy files as replace/delete candidates.

Acceptance:

- Active product imports into `src/dsxu/legacy` are zero or explicitly test-only.
- Each migrated path has owner evidence and focused tests.

### V20-R4 P12 Evaluation Correctness

Goal: P12 cannot claim quality comparison from weak target logs.

Actions:

- Add separate intake/integrity/quality statuses.
- Require target outcome validity checks.
- Keep `mustNotClaimComparisonWin=true` for blocked/partial target baselines unless explicitly allowed by manifest policy.

Acceptance:

- P12 can say "raw logs imported" without saying "comparison win".
- Delta report cannot produce PASS/win claims from blocked target quality.

### V20-R5 Real Operation Test Harness

Goal: V20 tests behave like real AI coding work, not only unit harnesses.

Actions:

- Use the V20 acceptance document as the source of truth.
- Run real CLI/TUI/UI/browser tasks against DSXU.
- Capture transcripts, tool traces, final reports, artifacts, metrics, risks, screenshots or recordings where applicable.

Acceptance:

- Functionality, experience, recovery, performance, evaluation, and release closure tests all have real evidence.
- Claude-like coding experience is judged by task completion, tool discipline, state visibility, recovery, and artifact quality.

## Feature Additions Needed For 100/100

1. Visible execution state ledger: every planning, tool, permission, recovery, and final decision emits user-safe state, not hidden reasoning.
2. Tool side-effect registry: every tool declares owner, side effect, permission, evidence, recovery, and release eligibility.
3. Real task runner UI/TUI: an operator can run V20 acceptance tasks and inspect transcripts, artifacts, screenshots, risks, and metrics in one place.
4. Quality evaluator separation: intake readiness, correctness, UX quality, recovery, performance, and release readiness are separate gates.
5. Agent orchestration contract: parent/worker lifecycle, partial worker handling, stop/resume, final synthesis, and user ask flows are first-class.
6. Provider/model router contract: routing, fallback, cost evidence, context windows, and model capability policy are explicit and testable.
7. Legacy absorption dashboard: production legacy imports, replace/delete candidates, owner signoff, and Git mutation readiness are tracked as one board.

## Execution Order

1. Fix P12 comparison semantics so evaluation cannot overclaim.
2. Fix permission-first tool execution and safe-command policy.
3. Split runtime-core composition and remove mock product returns.
4. Absorb active legacy imports into named DSXU owners.
5. Harden registry metadata and fallback semantics.
6. Run V20 real operation test sequence.
7. Only after the above: final comprehensive tests and clean export/release closure.

## Non-Negotiable Standards

- Duplicate behavior is merged into the original owner or marked replace/delete candidate.
- Different behavior maps to a named mainline owner.
- No second tool runtime, provider runtime, MCP runtime, skill runtime, permission runtime, or agent orchestrator.
- Compatibility is allowed only as test evidence or explicit adapter projection.
- A PASS must mean the product behavior is correct, not merely that a report file was produced.
