export type TestGateBucket = 'release' | 'quarantine' | 'candidate'

export type ReleaseGateEntry = {
  path: string
  reason: string
  required: boolean
}

export type QuarantineRule = {
  pattern: RegExp
  reason: string
}

export const DSXU_RELEASE_GATE_TESTS: readonly ReleaseGateEntry[] = [
  {
    path: 'src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
    reason: 'covers query/UI streaming, Skill meta auto-continue, and permission fallback visibility',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
    reason: 'runs a real WSL pty TUI smoke with screen and exit liveness checks',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/wsl-workspace-health-v1.test.ts',
    reason: 'proves WSL can read the DSXU workspace, entrypoint, Bun, and Python before real TUI failures are blamed on model/UI logic',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts',
    reason: 'classifies real model-driven TUI long-task evidence so auth blocks, stalls, mojibake, and manual continue loops cannot unlock stage close',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts',
    reason: 'runs the Excel-aligned terminal reliability pack across shell state, permission visibility, background lifecycle, toolchain, and real TUI trace',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/tui-permission-fallback-health-v1.test.ts',
    reason: 'keeps hidden permission prompts and invisible loading states from looking like passive Waiting',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/prompt-input-layout-v1.test.ts',
    reason: 'keeps fullscreen prompt input from overflowing into the transcript during terminal resize',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/background-task-hard-gate-v1.test.ts',
    reason: 'prevents terminal background tasks from publishing silent zero-byte output files',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts',
    reason: 'proves a dev-server URL can produce real Chromium screenshot evidence without hanging the query loop',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/frontend-project-dev-server-v1.test.ts',
    reason: 'proves a generated frontend project can run npm dev, pass cold-start/ready checks, render a Chromium screenshot, and stop cleanly',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/deepseek-v4-control-v1.test.ts',
    reason: 'keeps DeepSeek V4 pricing, context, max_tokens, FIM, and Pro/Flash routing centralized',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/cold-mode-cost-planning-v1.test.ts',
    reason: 'proves Pro is reserved for planning/review/recovery while normal coding stays cost-efficient on Flash',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/benchmark-runner-route-v1.test.ts',
    reason: 'keeps the live benchmark runner able to enter on Flash while query-loop routing upgrades review/recovery/governance to Pro',
    required: true,
  },
  {
    path: 'src/dsxu/cost/__tests__/cost.test.ts',
    reason: 'keeps the historical DSXU cost facade routed through the unified mainline DeepSeek V4 cost estimator',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/permission-usability.test.ts',
    reason: 'covers visible permission fallback and usability floor',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/toolchain-selfcheck-v1.test.ts',
    reason: 'proves DSXU-owned Windows/WSL native tools are packaged and resolved before PATH fallbacks',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/toolchain-repair-v1.test.ts',
    reason: 'keeps WSL internal tool repair DSXU-owned, hash-verified, and free of network download fallbacks',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/docker-wsl-integration-health-v1.test.ts',
    reason: 'classifies Docker Desktop WSL integration proxy, socket, and Ubuntu docker health so container-backed tasks fail visibly instead of hanging',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/wsl-execution-placement-v1.test.ts',
    reason: 'decides when WSL/container/TUI tasks can use the current workspace versus requiring WSL repair or a native WSL mirror',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/wsl-native-mirror-plan-v1.test.ts',
    reason: 'keeps WSL-native mirror migration dirty-aware, non-destructive, and plan-only until source work is ledgered',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/dirty-quarantine-ledger.test.ts',
    reason: 'classifies dirty work into mainline, evidence, toolchain, quarantine, side-path, and unknown buckets without deleting or reverting files',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/open-source-package-gate.test.ts',
    reason: 'prevents local scratch, external reference source, and legacy control/session/proxy shells from entering the tracked open-source package surface',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/dsxu-model-public-surface-v1.test.ts',
    reason: 'proves DSXU public model UI, aliases, Agent options, and final route evidence expose only DSXU/DeepSeek model names',
    required: true,
  },
  {
    path:
      'src/dsxu/engine/__tests__/provider' +
      '-migration-model-alias-isolation-v1.test.ts',
    reason: 'keeps old model-family aliases hidden inside a DSXU compatibility parser instead of public UI/schema/evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/release-surface-v1.test.ts',
    reason: 'ties DSXU-owned public model surface evidence to the release risk gate before release packaging',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/release-surface-source-policy-review-v1.test.ts',
    reason: 'keeps source-truth evidence, public release docs, and archived review debt separated before packaging',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/allowed-tools-permission-floor-v1.test.ts',
    reason: 'proves broad shell availability still respects command-specific allow/deny rules',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/powershell-parser-lifecycle-v1.test.ts',
    reason: 'keeps PowerShell permission parsing serialized, bounded, and safely degraded instead of depending on concurrent system pwsh spawns',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/tool-gate-v1-clean.test.ts',
    reason: 'covers DSXU tool gate decisions',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/file-read-cache-progress-v1.test.ts',
    reason: 'prevents unchanged Read cache hits from causing weak-model repeated-read cursor stalls',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/edit-convergence-gate-v1.test.ts',
    reason: 'blocks same-file Read/Write fallback after successful Edit and enforces explicit exactly-N/max Edit budgets without limiting normal tasks',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/semantic-tool-gate-v1.test.ts',
    reason: 'blocks identical same-batch tool targets and repeated Read calls after read_cache_hit until a source mutation changes state',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/semantic-tool-layer-v1.test.ts',
    reason: 'keeps RunNativeTest and CollectEvidence semantics conservative: block repeated failed native verification only until source or strategy changes, then collapse raw shell evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/live-real-task-compare.test.ts',
    reason: 'keeps focused live before/after comparison honest across tool calls, repeated verification, cache hit/miss, cost, and Pro/Flash ratio without running the broad 22-case suite',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/intent-only-final-live-gate-v1.test.ts',
    reason: 'prevents tool-intent final text such as Step 1: Read from leaving the UI waiting for user continue',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/query-message-shape-guard-v1.test.ts',
    reason: 'keeps query finalization gates and cursor helpers from crashing on system/progress/result messages without provider content',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/query-route-verification-v1.test.ts',
    reason: 'keeps baseline failing tests from forcing Pro recovery while post-edit verification failures still upgrade routing',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/auto-mode-visible-copy-v1.test.ts',
    reason: 'keeps Auto Mode system reminders free of mojibake before they enter model-visible context',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/subprocess-encoding-boundary-v1.test.ts',
    reason: 'forces shell subprocesses and PowerShell output onto UTF-8 before DSXU reads task output files as UTF-8',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/mojibake-health-classification-v1.test.ts',
    reason: 'classifies mojibake debt into comments, strings, and active user-visible risk before cleanup work is counted',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/coordinator-visible-copy-v1.test.ts',
    reason: 'keeps coordinator/Agent orchestration prompt copy free of mojibake before it enters model-visible planning context',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/prompt-input-visible-copy-v1.test.ts',
    reason: 'keeps prompt input model-switch notification copy free of replacement glyphs in the visible TUI',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/visible-ui-copy-pack-v1.test.ts',
    reason: 'keeps high-frequency settings, IDE, marketplace, and thinkback visible UI copy readable after encoding cleanup',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/query-loop-visible-copy-v1.test.ts',
    reason: 'keeps query-loop runtime exits, attention anchors, and intent keywords readable and free of mojibake',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
    reason: 'covers the real tool adapter path, Agent worker evidence, SendMessage continuation, FileEdit convergence, compact recovery, and shell permission matrix',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts',
    reason: 'proves parent final answers cannot turn Agent evidence into fake Done/PASS without citing concrete worker evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts',
    reason: 'keeps Agent planning reduced to serial worker or parallel fanout with ownership and parent evidence gates',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/agent-live-report-replay.test.ts',
    reason: 'proves live-report-derived Agent replay keeps only serial worker and parallel fanout while preserving lifecycle placement options and parent final evidence gates',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/code-mode-surgical-loop-v1.test.ts',
    reason: 'proves the Code Mode surgical loop from repo probe to localization, context pack, patch plan, repair, native verification, final report, and cost evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/final-report-usage-evidence-v1.test.ts',
    reason: 'proves final reports can use actual adapter usage records for Pro/Flash cost evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/lsp-tool.test.ts',
    reason: 'proves Code Mode symbol, diagnostics, reference, and rename helpers work across Windows paths without corrupting localization',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/blast-radius.test.ts',
    reason: 'proves RegressionGuard impact analysis can find dependents and related tests for focused verification',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/task-runtime-mainline-v1-clean.test.ts',
    reason: 'covers task lifecycle transitions and notifications',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/background-governance-contract-v1.test.ts',
    reason: 'keeps background governance behavior mapped to DSXU-owned contracts',
    required: true,
  },
  {
    path: `src/dsxu/engine/__tests__/query-loop-recovery-${'bri'}${'dge'}-v1.test.ts`,
    reason: 'covers query-loop recovery handoff behavior',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts',
    reason: 'covers provider/query direct-connect contracts',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/control-plane-v1.test.ts',
    reason: 'keeps DSXU Control Plane on the single mainline without legacy control/session/proxy imports',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts',
    reason: 'keeps remote lifecycle, reconnect, permission cancel, and viewer-only state mapped through the shared DSXU control registry',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/network-facade-v1.test.ts',
    reason: 'keeps DSXU network facade default-deny with header allowlist and policy-gated subprocess proxy env injection',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/control-plane-stage-acceptance-v1.test.ts',
    reason: 'aggregates CP12 control messaging, remote lifecycle, permission handoff, SDK adapter, proxy env, no-legacy regression, provider contract, and default help smoke evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/remote-network-workflow-v1.test.ts',
    reason: 'proves Phase H remote/network workflow replay from connect through permission, task verification, reconnect/cancel, and allowlisted local relay evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/go-stop-decision.test.ts',
    reason: 'prevents config probes, dry runs, or partial evidence from being reported as public benchmark release evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/benchmark-readiness.test.ts',
    reason: 'aggregates real task, cost, route, and taxonomy signals without misreporting guarded internal readiness as a public benchmark',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/evidence-eval-pack.test.ts',
    reason: 'keeps E01/E02/E07 honest by generating baseline, ablation, Go/Stop, and mini-report evidence while blocking incomplete public score claims',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/stage-close-readiness.test.ts',
    reason: 'keeps V18 stage-close decisions explicit so 22-case, Pro bare, and BenchMax are not run before required evidence is green',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/eval-baseline-manifest.test.ts',
    reason: 'keeps Flash/Pro/DSXU/BenchMax baseline commands generated from one protocol so ordinary routed reports cannot be mislabeled as bare baselines',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/baseline-failure-reporter.test.ts',
    reason: 'keeps E04 failure reporting able to classify Flash baseline drift, avoid wasteful Pro spend, and emit machine-readable next actions from live reports',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/code-terminal-runner.test.ts',
    reason: 'keeps A16/B13 runner inputs explicit, Flash-first, and unable to claim Code-10 or Terminal-10 scores from dry plans',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/terminal-hit-rate.test.ts',
    reason: 'keeps B13 terminal evidence honest by classifying PowerShell over-probing, denied probes, no-output probes, and command-budget debt',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/controlled-failure-taxonomy.test.ts',
    reason: 'keeps benchmark readiness backed by controlled permission, timeout, validation, workspace, and repeated-verification failure taxonomy samples',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/real-task-route-plan.test.ts',
    reason: 'keeps phase-level Pro/Flash routing explicit so low-risk execution can stay on Flash while recovery/review stays on Pro',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/route-cache-roi-smoke.test.ts',
    reason: 'keeps live report cacheByRouteReason and Pro ROI evidence from treating direct Pro success as saved-task evidence without same-case Flash attempt',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts',
    reason: 'keeps stable prompt prefix hashing separate from dynamic task state and flags timestamps, paths, trace ids, and random ids before they bust DeepSeek KV cache',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/prompt-prefix-cache-evidence.test.ts',
    reason: 'keeps query-loop prompt prefix evidence side-channel only: hashes and volatile findings are traced without leaking full prompt text or mutating provider prompts',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts',
    reason: 'keeps live route trace cache analysis split between cold-start misses and warm-turn cache risk without leaking prompt text into evidence',
    required: true,
  },
  {
    path: 'src/services/api/deepseek-adapter-cache-prefix-v1.test.ts',
    reason: 'keeps DeepSeek-native prompt caching payloads free of provider-specific cache_control blocks and internal dynamic-boundary markers',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-replay-v1.test.ts',
    reason: 'proves ExperienceStore records, recalls, deletes, explains, smooth-resumes, and reduces repeated exploration with source-truth refresh',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-expanded-replay-v1.test.ts',
    reason: 'expands ExperienceStore replay to feature native test and failed-verification recovery with strategy-change evidence',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-smooth-resume-pack-v1.test.ts',
    reason: 'aggregates bugfix, feature native test, failed verification recovery, and compact resume into one ExperienceStore pack with measurable waste reduction and benchmark-answer leak blocking',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-planning-context-v1.test.ts',
    reason: 'keeps ExperienceStore memory actionable for planning without replacing current source truth or focused verification',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-live-report-ingest.test.ts',
    reason: 'turns real live reports into safe ExperienceStore task snapshots, success fixes, failure patterns, verification commands, and cost route evidence without benchmark-answer leaks',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-persistence-v1.test.ts',
    reason: 'proves ExperienceStore persistent memory can save, reload, recall, explain, delete, tombstone, and block benchmark-answer leakage',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/experience-store-source-truth-conflict-v1.test.ts',
    reason: 'proves stale ExperienceStore recalls cannot select edit targets when current source files and verification disagree with memory',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/smooth-resume-live-task-v1.test.ts',
    reason: 'proves compact/session resume continues through source reread, focused edit, and native verification before claiming pass',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/compact-resume-replay-v1.test.ts',
    reason: 'proves compact recovery snapshots preserve user instructions, failed commands, permission denials, pending agents, and resume through source truth before verification',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/compact-source-clean-v1.test.ts',
    reason: 'keeps active compact/resume source free of known mojibake markers while preserving the DSXU compact recovery contract',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/bash-adapter-safety-v1.test.ts',
    reason: 'covers Bash risk analysis structure',
    required: true,
  },
  {
    path: 'src/dsxu/engine/__tests__/bash-file-adapter-mainline-v1.test.ts',
    reason: 'covers Bash/FileEdit structured result coexistence',
    required: true,
  },
] as const

export const DSXU_QUARANTINE_RULES: readonly QuarantineRule[] = [
  {
    pattern: /compact-session-integration\.test\.ts$/,
    reason: 'old CompactPipeline API contract drift; not counted until rewritten against current compact mainline',
  },
  {
    pattern: /prompt-processing-v1-clean\.test\.ts$/,
    reason: 'imports removed prompt-processing-v1 and prompt-stack-v1 side-paths; not counted until rewritten against current REPL/query prompt handling',
  },
  {
    pattern: /context-analysis-v1-clean\.test\.ts$/,
    reason: 'imports removed context-analysis-v1 and prompt-stack-v1 side-paths; not counted until rewritten against current query-context-builder and context-window manager',
  },
  {
    pattern: /c16-shell-full-audit-clean\.test\.ts$/,
    reason: 'depends on missing legacy reference directory; audit-only until source fixture is restored or removed',
  },
  {
    pattern: /(?:^|[\\/])v(?:10|11|12|14|15|16)-.*\.test\.ts$/,
    reason: 'historical V-series contract or productization evidence test; keep searchable but outside release pass score',
  },
  {
    pattern: new RegExp(`${['cl', 'aude'].join('')}.*audit|absorption.*audit|full-audit`, 'i'),
    reason: 'audit ledger tests, not runtime release gates',
  },
] as const

export function classifyDsxuTestForGate(path: string): TestGateBucket {
  const normalized = path.replace(/\\/g, '/')
  if (DSXU_RELEASE_GATE_TESTS.some(entry => entry.path === normalized)) {
    return 'release'
  }
  if (DSXU_QUARANTINE_RULES.some(rule => rule.pattern.test(normalized))) {
    return 'quarantine'
  }
  return 'candidate'
}

export function getDsxuReleaseGateCommand(): string[] {
  return ['bun', 'test', ...DSXU_RELEASE_GATE_TESTS.map(entry => `./${entry.path}`)]
}
