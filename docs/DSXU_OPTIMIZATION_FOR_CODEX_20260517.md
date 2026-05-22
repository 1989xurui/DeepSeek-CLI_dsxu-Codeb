# DSXU Code Optimization Plan — Codex / GPT-5.5 Execution Target

**Version:** 1.0  
**Date:** 2026-05-17  
**Target:** Take DSXU Code from score-floor 72 → 90+ (public claim viability)  
**Executor:** Codex / GPT-5.5  
**Repository root:** `/mnt/d/DSXU-code`

---

## Executive Summary

DSXU Code is a DeepSeek-first AI coding CLI/TUI with 26 test packs (98 cases), senior coding window of 30.58 minutes, 86.2% cost reduction via cache ablation, and a score floor of 72/100. The gap to 90+ is not in model capability — it is in **external validation pipeline, verification automation, benchmark surface, and public evidence packaging**.

The changes below target only these gaps. No architecture rewrite needed. DSXU already has `coordinator/` (orchestrator, DAG, voting, tdd-gate), `services/eval/swe-bench/`, `services/static-analysis/`, `services/sandbox/`, `services/embedding/`, `dsxu/cost/`, and a full evidence script pipeline. The old SWE service owner is now a replace/delete candidate and must not be used as a product runtime.

---

## 1. SWE-Bench External Validation Pipeline

**Why:** The DSXU-owned SWE evaluation owner exists at `src/services/eval/swe-bench/`, but public release claims still require fixed manifests, raw transcripts, rubric scoring, cost/cache evidence, and paired external evidence. Without external benchmark evidence, no 90+ claim is credible.

**Files to create or change:**

```
src/services/eval/swe-bench/
  contract.ts     ← EXISTS
  bridge.ts       ← EXISTS
  index.ts        ← EXISTS
  judge.ts        ← CREATE: ground-truth diff comparison, PASS/FAIL per instance
  runner.ts       ← CREATE: batch execution + verdict collection

scripts/dsxu-swe-bench-runner.ts  ← CREATE: CLI entrypoint, batch config, result export

docs/generated/                   ← RESULT GOES HERE as JSON evidence file
```

**Implementation:**

### 1a. `src/services/eval/swe-bench/runner.ts`

```typescript
// Core runner: given a list of SWE-bench instance IDs,
// for each instance: checkout → apply patch → run DSXU → collect result → diff against ground truth
// Output: { instanceId: string, status: "PASS"|"FAIL"|"TIMEOUT", dsxuPatch: string, groundTruthPatch: string, diff: string, turns: number, cost: number }

import { type SweBenchInstance, type SweBenchResult } from './contract';
import { type SweBenchAdapter } from './index';
import { type EvalJudge } from '../eval/swe-bench/judge';

export interface RunnerConfig {
  instanceIds: string[];
  timeoutMs: number;
  maxTurns: number;
  model: string;         // e.g. "deepseek-v4-flash"
  workspaceRoot: string;  // temp dir for checkout
}

export interface RunnerResult {
  instanceId: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT';
  dsxuPatch: string;
  groundTruthPatch: string;
  diffSimilarity: number;  // 0.0 - 1.0, based on unified diff overlap
  turnsUsed: number;
  costUsd: number;
  error?: string;
}

export class SweBenchRunner {
  constructor(
    private adapter: SweBenchAdapter,
    private judge: EvalJudge,
  ) {}

  async run(config: RunnerConfig): Promise<RunnerResult[]> {
    // 1. Load instance specs from adapter
    // 2. For each instance in parallel (configurable concurrency):
    //    a. git checkout problem repo at problem commit
    //    b. Write the test file describing the expected fix
    //    c. Run DSXU with Read/Edit/Bash tools on the repo
    //    d. Capture the patch DSXU produces
    //    e. Compare against ground truth patch via judge
    // 3. Return aggregated results
    // 4. Write results to docs/generated/DSXU_SWE_BENCH_RESULTS_{date}.json
    throw new Error('implement');
  }
}
```

### 1b. `src/services/eval/swe-bench/judge.ts`

```typescript
// Verdict: does DSXU's patch pass the SWE-bench test suite?
// Strategy: apply DSXU patch, run the instance test, check test output

export interface Verdict {
  instanceId: string;
  passed: boolean;
  testOutput: string;
  patchMatch: number;  // similarity to ground truth
}

export class SweBenchJudge {
  async judge(instanceId: string, dsxuPatch: string, groundTruthPatch: string): Promise<Verdict> {
    // Normalize both patches (strip whitespace, line numbers)
    // Compute unified diff overlap
    // If patch overlap > 0.8 AND tests pass → PASS
    // If tests pass but patch differs → PARTIAL
    // If tests fail → FAIL
    throw new Error('implement');
  }
}
```

### 1c. `scripts/dsxu-swe-bench-runner.ts`

```typescript
#!/usr/bin/env bun
// Entrypoint: bun run scripts/dsxu-swe-bench-runner.ts --instances "id1,id2,id3" --timeout 120000

// CLI:
//   --instances CSV list or "all" for full SWE-bench lite
//   --model "deepseek-v4-flash" | "deepseek-v4-pro"
//   --timeout ms per instance
//   --output path for results JSON (default docs/generated/)

// Actions:
// 1. Instantiate SweBenchRunner
// 2. Run
// 3. Write results JSON
// 4. Print summary: PASS count, FAIL count, avg cost, avg turns

// Integration: after runner completes, call into release gate preflight
// to check: passRate >= 0.80 for release gate to pass
```

**Verification:**
```bash
bun run scripts/dsxu-swe-bench-runner.ts --instances "mock-test-001,mock-test-002" --timeout 60000
# Expected output: JSON at docs/generated/DSXU_SWE_BENCH_RESULTS_20260517.json
# At least 1 PASS and 0 CRASH
```

---

## 2. Verification Pipeline — Mandatory Post-Edit Gate

**Why:** DSXU already has `src/coordinator/tdd-gate/` (extractor, generator, gate). The gap is that after every Write/Edit tool call, verification is not enforced. Codex's strength is that every code change is immediately verified before the next action.

**Files to change:**

```
src/coordinator/tdd-gate/
  extractor.ts  ← EXISTS (extracts test targets from code)
  generator.ts  ← EXISTS (generates test stubs)
  gate.ts       ← EXISTS (orchestrates the gate)
  index.ts      ← EXISTS

src/tools/WriteTool.ts  ← MODIFY: add post-write verification hook
src/tools/EditTool.ts   ← MODIFY: add post-edit verification hook
```

### 2a. Add `TddGate.invoke()` call after Write/Edit

In `WriteTool.ts` and `EditTool.ts`, after a successful write/edit:

```typescript
// After successful tool execution:
if (config.verificationGate.enabled) {
  const tddGate = new TddGate(config);
  const result = await tddGate.invoke({
    filePath: targetPath,
    changeType: 'write',  // or 'edit'
    oldContent: beforeContent,
    newContent: afterContent,
    repoRoot: config.repoRoot,
  });
  // If result.status === 'FAIL' → enqueue recovery, do not proceed
  // If result.status === 'PARTIAL' → log warning, proceed with caution
  // If result.status === 'PASS' → log evidence, proceed
  evidence.record('verification-gate', result);
}
```

### 2b. Configuration toggle

In `src/context/prompt-profile.ts` or a new config key:

```typescript
toolGate: {
  postWriteVerification: boolean; // default: true
  postWriteVerificationMode: 'full-test' | 'compile-only' | 'lint-only'; // default: 'lint-only'
}
```

### 2c. Verification failure classification

In the recovery loop (`src/context/recovery.ts` or equivalent):

```typescript
type VerificationFailure =
  | { type: 'compile-error'; output: string }
  | { type: 'test-failure'; testName: string; output: string }
  | { type: 'lint-violation'; rule: string; file: string; line: number }
  | { type: 'unexpected-diff'; expected: string; actual: string };

// On VerificationFailure with type 'compile-error' or 'test-failure':
// → Classification: "Regression" → rollback to last checkpoint
// → Classification: "Pre-existing" → log as pre-existing, proceed
```

**Verification:**
```bash
bun run test src/coordinator/tdd-gate/__tests__/gate.test.ts
# Expected: all existing tests pass, new tests for post-write hook pass
```

---

## 3. PlanGraph / Work-State — Plan-Execute-Verify Projection

**Why:** DSXU must not keep a second coordinator runtime for plan/execute/verify. The old DAG owner is now harness-only owner-review evidence. Product behavior belongs to the existing query-loop, PlanGraph/work-state projection, Tool Gate, and VerificationKernel.

**Files to change or verify:**

```
src/dsxu/engine/work-state-timeline.ts
  projectDSXUPlanTemplateToWorkStateEvents()  ← DSXU-owned visible-state projection

src/coordinator/dag/
  status        ← replace/delete review candidate or harness-only historical source
```

### 3a. Keep PEV inside DSXU work-state

```typescript
projectDSXUPlanTemplateToWorkStateEvents({
  templateId: 'plan-execute-verify',
  title: 'Plan / execute / verify template for code-changing work',
  nodes: [
    { id: 'plan', kind: 'planner', deps: [] },
    { id: 'execute', kind: 'executor', deps: ['plan'] },
    { id: 'verify', kind: 'verifier', deps: ['execute'] },
  ],
});
```

**Verification:**
```bash
bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts
bun run scripts/dsxu-dag-owner-review.ts
# Expected: PEV projects into work-state; old DAG owner has no runtime/test import/use outside historical review evidence.
```

---

## 4. Evidence Pipeline — Unified Dashboard

**Why:** DSXU generates evidence files in `docs/generated/` (benchmark data, ablation, coding window, etc.) but there is no single dashboard that aggregates all metrics. Without aggregation, the 72→90+ trajectory is invisible.

**Files to create:**

```
scripts/dsxu-evidence-dashboard.ts  ← CREATE: aggregate all evidence JSONs into a dashboard
```

### 4a. `scripts/dsxu-evidence-dashboard.ts`

```typescript
// Reads: all JSON files from docs/generated/
// Outputs: structured dashboard with trend lines

interface EvidenceDashboard {
  generatedAt: string;
  scoreFloor: number;
  trajectory: {
    date: string;
    metric: string;
    value: number;
  }[];
  gates: {
    name: string;
    status: 'PASS' | 'FAIL' | 'NOT_RUN';
    lastRun: string;
    evidenceFile: string;
  }[];
  benchmarkResults: {
    name: string;
    passRate: number;
    sampleCount: number;
    date: string;
  }[];
  costMetrics: {
    beforeUsd: number;
    afterUsd: number;
    reduction: string;
  };
}

export function aggregateEvidence(): EvidenceDashboard {
  // 1. Scan docs/generated/*.json
  // 2. For each, extract key metrics based on filename prefix
  // 3. Aggregate into dashboard
  // 4. Write docs/generated/DSXU_EVIDENCE_DASHBOARD_{date}.json
}

// CLI entrypoint:
if (require.main === module) {
  const dashboard = aggregateEvidence();
  console.log(JSON.stringify(dashboard, null, 2));
  // Also print human-readable summary
  console.log(`Score floor: ${dashboard.scoreFloor}`);
  dashboard.gates.filter(g => g.status === 'PASS').forEach(g => console.log(`  ✓ ${g.name}`));
}
```

**Verification:**
```bash
bun run scripts/dsxu-evidence-dashboard.ts
# Expected: prints aggregated dashboard JSON + human summary
# All existing evidence files are parsed without error
```

---

## 5. Cost/Cache Optimization — Automatic Cache Warming

**Why:** DSXU already reduced cost 86.2% via cache ablation. The next step is automatic cache warming: pre-populate cache entries for common prompt prefixes used in the fixed task catalog.

**Files to change:**

```
src/services/cache-stats.ts            ← EXISTS
src/services/cache-stats.integration.test.ts  ← EXISTS
src/dsxu/cost/cost-tracker.ts          ← EXISTS (referenced in README)

src/services/cache-warmer.ts           ← CREATE: warming logic
scripts/dsxu-cache-warm.ts             ← CREATE: CLI entrypoint
```

### 5a. `src/services/cache-warmer.ts`

```typescript
// Cache warming strategy:
// 1. Identify 10-20 most common prompt prefixes from DSXU routing table
// 2. For each, construct a minimal probe request (first 50 tokens)
// 3. Send probe to DeepSeek API to populate cache
// 4. Cache warm success = cache hit for subsequent real requests

export interface CacheWarmConfig {
  prefixes: string[];
  model: string;
  concurrency: number;
}

export interface CacheWarmResult {
  warmedKeys: number;
  failedKeys: number;
  estimatedSavingsUsd: number;
  durationMs: number;
}

export class CacheWarmer {
  // Warm cache for a list of prompt prefixes
  async warm(config: CacheWarmConfig): Promise<CacheWarmResult> {
    // For each prefix:
    // 1. Construct probe: the first N tokens of a typical request using this prefix
    // 2. Send as a streaming completion request (minimal output tokens)
    // 3. Record cache key
    // Result: warmedKeys count, duration
    throw new Error('implement');
  }
}
```

### 5b. Integration point

Add cache warming to the startup sequence in `src/entrypoints/dsxu-code.tsx`:

```typescript
// After provider initialization, in background:
if (config.cacheWarming.enabled !== false) {
  const warmer = new CacheWarmer(provider);
  warmer.warm({
    prefixes: config.cacheWarming.prefixes, // read from config or use defaults
    model: config.model,
    concurrency: 2,
  }).then(result => {
    logger.info(`Cache warmed: ${result.warmedKeys} keys, ~$${result.estimatedSavingsUsd}`);
  }).catch(err => {
    logger.warn(`Cache warm failed (non-fatal): ${err.message}`);
  });
}
```

**Verification:**
```bash
bun test src/services/cache-stats.test.ts
bun run scripts/dsxu-cache-warm.ts --dry-run
# Expected: cache-warm runs without API calls in dry-run mode
# Cache stats test passes
```

---

## 6. Security — Mandatory Static Analysis Gate

**Why:** `src/services/static-analysis/` exists with semgrep, eslint, and ast-grep parsers. The gap is that these are not automatically gated on code write.

**Files to change:**

```
src/services/static-analysis/
  index.ts        ← EXISTS (main entry)
  bridge.ts       ← EXISTS (adapter bridge)
  parsers/
    semgrep.ts    ← EXISTS
    eslint.ts     ← EXISTS
    ast-grep.ts   ← EXISTS

src/tools/WriteTool.ts  ← MODIFY: add SAST scan before committing write
src/tools/EditTool.ts   ← MODIFY: add SAST scan before committing edit
```

### 6a. SAST gate in Write/Edit tool chain

After content is prepared but before file is written:

```typescript
// After we have the new content but before writing:
const analysisResults = await staticAnalysisBridge.scan({
  filePath: targetPath,
  content: newContent,
  parsers: ['semgrep', 'eslint'],  // fastest ones for the gate
});

const blockingIssues = analysisResults.filter(r => r.severity === 'error');
if (blockingIssues.length > 0) {
  // Report to user, offer to fix before writing
  // If auto-fix is enabled, attempt to fix and re-scan
  evidence.record('static-analysis-blocked', {
    file: targetPath,
    issues: blockingIssues,
  });
  // Gate blocks unless user overrides with --force
}
```

### 6b. Regression test generation for security fixes

When a security fix is applied (identified by SAST rules or explicitly tagged):

```typescript
// In the coordinator, after a security fix is applied:
if (changeType === 'security-fix') {
  const regressionTest = generateSecurityRegressionTest({
    vulnerability: fixDetails.vulnerabilityType,  // 'sql-injection' | 'xss' | 'path-traversal'
    filePath: targetPath,
    originalCode: beforeContent,
    fixedCode: afterContent,
  });
  // Write regression test to __tests__/security/{timestamp}.test.ts
  // The test must fail on the old code and pass on the new code
}
```

**Verification:**
```bash
bun test src/services/static-analysis/__tests__/bridge.test.ts
bun test src/services/static-analysis/__tests__/parsers/semgrep.test.ts
bun test src/services/static-analysis/__tests__/parsers/eslint.test.ts
# Expected: all existing tests pass
```

---

## 7. Self-Diagnosis — Runtime Health Check

**Why:** DSXU already has `docs/DOCTOR_HEALTH.md` and doctor scripts. Add a runtime self-check that validates all tool gates, permissions, and dependencies before accepting tasks.

**Files to create:**

```
src/services/health/      ← CREATE directory
  index.ts               ← Health check runner
  checks.ts              ← Individual check functions
  contract.ts            ← Types

scripts/dsxu-runtime-health.ts  ← CREATE: CLI entrypoint
```

### 7a. `src/services/health/contract.ts`

```typescript
export interface HealthCheck {
  name: string;
  category: 'tool' | 'permission' | 'model' | 'environment' | 'cache';
  severity: 'critical' | 'warning' | 'info';
  run(): Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  detail?: string;
  durationMs: number;
}

export interface HealthReport {
  overall: 'PASS' | 'FAIL' | 'DEGRADED';
  checks: HealthCheckResult[];
  generatedAt: string;
}
```

### 7b. `src/services/health/checks.ts`

Checks to implement:

| Check | Category | What it validates |
|-------|----------|-------------------|
| `toolRegistryHealth` | tool | All registered tools resolve, schema is valid |
| `permissionGateHealth` | permission | Permission gate responds correctly |
| `modelConnectivity` | model | DeepSeek API responds (lightweight ping) |
| `fileSystemAccess` | environment | Read/Write/Glob work on test paths |
| `cacheHealth` | cache | Cache is accessible, hit rate > 0 |
| `sandboxHealth` | environment | Sandbox (WSL2/native) is reachable |
| `mcpHealth` | tool | MCP server list is loadable |
| `coordinatorHealth` | tool | DAG runner, tdd-gate, voting all load |

**Verification:**
```bash
bun run scripts/dsxu-runtime-health.ts
# Expected: all checks run, overall status printed
# At minimum: all critical checks PASS
```

---

## 8. Package.json Scripts — Add New Entrypoints

Add to `package.json` scripts section:

```json
{
  "benchmark:swe-bench": "bun run scripts/dsxu-swe-bench-runner.ts",
  "evidence:dashboard": "bun run scripts/dsxu-evidence-dashboard.ts",
  "health:runtime": "bun run scripts/dsxu-runtime-health.ts",
  "cache:warm": "bun run scripts/dsxu-cache-warm.ts"
}
```

---

## Implementation Order

| Order | Module | Est. Time | Risk | Gate |
|-------|--------|:---------:|:----:|------|
| 1 | Verification pipeline (tdd-gate post-write hook) | 4h | Low | Must pass coordinate gates |
| 2 | SWE-bench runner + judge | 8h | Medium | SWE-bench mock instances pass |
| 3 | Coordinator DAG PEV template | 4h | Low | Existing DAG tests pass |
| 4 | Evidence dashboard | 3h | Low | All evidence files parse |
| 5 | Cache warmer | 3h | Low | Dry-run succeeds |
| 6 | Static analysis gate | 4h | Medium | SAST tests + no false positives |
| 7 | Runtime health check | 3h | Low | All critical checks PASS |
| 8 | Script entrypoints | 1h | Low | `bun run <name>` works |

**Total: ~30h engineering time.**

---

## Score Floor Impact Estimate

| Metric | Current | Target | After implementation |
|--------|:-------:|:------:|:-------------------:|
| SWE-bench pass rate | none | 80%+ | +8-10 points |
| Verification automation | ad-hoc | every edit | +4-6 points |
| DAG PEV template | none | structured | +3-5 points |
| Evidence dashboard | manual | automated | +2-3 points |
| Cache warming | none | automated | +1-2 points |
| SAST gate | available | enforced | +2-3 points |
| **Total estimated** | **72** | **92-99** | **+20-27 points** |

---

## Verification of This Plan

After all 8 modules are implemented:

```bash
# 1. Run all existing tests
bun test

# 2. Run the evidence dashboard
bun run evidence:dashboard
# → Shows aggregated metrics, score floor trend, gate statuses

# 3. Run SWE-bench on a 5-instance sample
bun run benchmark:swe-bench --instances "sample1,sample2,sample3,sample4,sample5"
# → Shows pass rate, cost, turns per instance

# 4. Run runtime health
bun run health:runtime
# → All critical checks PASS

# 5. Run release gate (final check)
bun run test:six-stage-final
# → 20/20 command batches passed

# 6. Run acceptance gate
bun run acceptance:senior-coding-window
# → 30+ minute window, final fixture test passed
```

If all 6 checks pass, DSXU Code can update its public claim from 72 to 90+.
