import { describe, expect, test } from 'bun:test'
import {
  finalTextHasStandaloneMarker,
  benchmarkCaseRequiresInitialNativeVerification,
  getBenchmarkRouteExpectation,
  getBenchmarkCaseForTest,
  getModelForcedBarePolicyViolations,
  hasModelForcedBareBashVerificationViolation,
  inferBenchmarkExactSuccessfulEditBudget,
  normalizeBenchmarkAllowedTools,
  parseBenchmarkEntryModelMode,
  renderBenchmarkFinalMarkerContract,
  renderBenchmarkPowerShellVerificationContract,
  resolveBenchmarkEntryModel,
} from '../../../../scripts/benchmark/dsxu-mainline-benchmark'

describe('benchmark runner route wiring V1', () => {
  test('starts benchmark packs Flash-first by default while preserving explicit current/pro modes', () => {
    expect(parseBenchmarkEntryModelMode(undefined)).toBe('auto')
    expect(parseBenchmarkEntryModelMode('bad-value')).toBe('auto')
    expect(parseBenchmarkEntryModelMode('current')).toBe('current')
    expect(resolveBenchmarkEntryModel(parseBenchmarkEntryModelMode(undefined))).toBe('deepseek-v4-flash')
    expect(resolveBenchmarkEntryModel('flash')).toBe('deepseek-v4-flash')
    expect(resolveBenchmarkEntryModel('auto')).toBe('deepseek-v4-flash')
    expect(resolveBenchmarkEntryModel('current')).toBeUndefined()
    expect(resolveBenchmarkEntryModel('pro')).toBe('deepseek-v4-pro')
  })

  test('predicts low-risk execution and non-risk review/recovery on Flash while preserving Pro governance', () => {
    expect(getBenchmarkRouteExpectation({ category: 'bugfix' })).toMatchObject({
      workflowKind: 'bugfix',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'coding_flash_non_thinking',
    })
    expect(getBenchmarkRouteExpectation({ category: 'feature' })).toMatchObject({
      workflowKind: 'feature',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'coding_flash_non_thinking',
    })
    expect(getBenchmarkRouteExpectation({ category: 'review' })).toMatchObject({
      workflowKind: 'review',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'review_flash_thinking_max',
    })
    expect(getBenchmarkRouteExpectation({ category: 'recovery' })).toMatchObject({
      workflowKind: 'recovery',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'recovery_flash_thinking_max',
    })
    expect(getBenchmarkRouteExpectation({ category: 'permission' })).toMatchObject({
      workflowKind: 'review',
      expectedModel: 'deepseek-v4-pro',
      routeReason: 'high_risk_pro_thinking_max_requires_approval',
    })
    expect(getBenchmarkRouteExpectation({ category: 'agent' })).toMatchObject({
      workflowKind: 'planning',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'recovery_flash_thinking_max',
    })
  })

  test('uses prompt-aware permission expectations instead of forcing every terminal case to Pro', () => {
    expect(getBenchmarkRouteExpectation({
      category: 'permission',
      prompt: 'Inspect a Windows path safely with PowerShell without destructive commands, report evidence, and stop.',
    })).toMatchObject({
      workflowKind: 'generic_chat',
      expectedModel: 'deepseek-v4-flash',
      routeReason: 'lightweight_flash_non_thinking',
    })

    expect(getBenchmarkRouteExpectation({
      category: 'permission',
      prompt: 'A risky command would force-push and delete a protected cache directory. Treat it as denied and replan with a read-only path.',
    })).toMatchObject({
      workflowKind: 'review',
      expectedModel: 'deepseek-v4-pro',
      routeReason: 'high_risk_pro_thinking_max_requires_approval',
    })
  })

  test('accepts final PASS marker glued to evidence only when it is the terminal token', () => {
    expect(finalTextHasStandaloneMarker(
      'All evidence is confirmed. DSXU_BENCH_PERMISSION_MATRIX_PASS',
      'DSXU_BENCH_PERMISSION_MATRIX_PASS',
    )).toBe(true)
    expect(finalTextHasStandaloneMarker(
      'All evidence is confirmed.\nDSXU_BENCH_PERMISSION_MATRIX_PASS',
      'DSXU_BENCH_PERMISSION_MATRIX_PASS',
    )).toBe(true)
    expect(finalTextHasStandaloneMarker(
      'Since not all required strings are present, DSXU_BENCH_PERMISSION_MATRIX_PASS is not asserted.',
      'DSXU_BENCH_PERMISSION_MATRIX_PASS',
    )).toBe(false)
    expect(finalTextHasStandaloneMarker(
      'Do not output DSXU_BENCH_PERMISSION_MATRIX_PASS',
      'DSXU_BENCH_PERMISSION_MATRIX_PASS',
    )).toBe(false)
  })

  test('locks high-risk permission replan as a zero-tool policy case', () => {
    expect(getBenchmarkCaseForTest('permission-deny-replan')).toMatchObject({
      maxToolCalls: 0,
      maxReadCalls: 0,
      maxPowerShellCalls: 0,
    })
  })

  test('locks encoded PowerShell deny proof to a narrow ASCII Grep-only path', () => {
    expect(getBenchmarkCaseForTest('powershell-encoded-deny')).toMatchObject({
      allowedTools: 'Grep',
      maxToolCalls: 2,
      maxReadCalls: 0,
      maxPowerShellCalls: 0,
    })
    expect(getBenchmarkCaseForTest('powershell-encoded-deny')?.prompt).toContain('ASCII-only')
  })

  test('locks Terminal-10 prompt-only failures into concrete bounded tasks', () => {
    expect(getBenchmarkCaseForTest('grep-glob-tool-choice')).toMatchObject({
      maxToolCalls: 2,
      maxReadCalls: 0,
    })
    expect(getBenchmarkCaseForTest('grep-glob-tool-choice')?.prompt).toContain(
      'which DSXU engine file implements the Terminal hit-rate analyzer',
    )

    expect(getBenchmarkCaseForTest('todo-task-closeout')).toMatchObject({
      allowedTools: 'TaskCreate',
      maxToolCalls: 3,
      maxReadCalls: 0,
    })
    expect(getBenchmarkCaseForTest('todo-task-closeout')?.prompt).toContain(
      'Use TaskCreate exactly three times',
    )
  })

  test('locks permission matrix proof away from Grep path-parameter ambiguity', () => {
    expect(getBenchmarkCaseForTest('permission-matrix-contract')).toMatchObject({
      allowedTools: 'Grep',
      maxToolCalls: 2,
      maxReadCalls: 0,
      maxTurns: 8,
    })
    expect(getBenchmarkCaseForTest('permission-matrix-contract')?.prompt).toContain(
      'Do not use Read, shell commands, or the Grep path parameter',
    )
    expect(getBenchmarkCaseForTest('permission-matrix-contract')?.prompt).toContain(
      'glob parameter exactly "mainline-tool-adapter-v1.test.ts"',
    )
  })

  test('locks compact state preservation to a provided zero-tool snapshot', () => {
    expect(getBenchmarkCaseForTest('compact-state-preservation')).toMatchObject({
      maxToolCalls: 0,
      maxReadCalls: 0,
    })
    expect(getBenchmarkCaseForTest('compact-state-preservation')?.prompt).toContain(
      'Do not use tools',
    )
    expect(getBenchmarkCaseForTest('compact-state-preservation')?.prompt).toContain(
      'verificationStatus="partial"',
    )
  })

  test('locks product workflow recovery to baseline-first and two-file context', () => {
    const workflowCase = getBenchmarkCaseForTest('product-workflow-recovery-live')
    expect(workflowCase).toMatchObject({
      requirePreEditBaselineVerification: true,
    })
    expect(workflowCase?.prompt).toContain('First run bun test with PowerShell')
    expect(workflowCase?.prompt).toContain('Then read only src/format.js and test/format.test.js')
    expect(workflowCase?.prompt).toContain('Do not read package.json or .dsxu/workflows/repair.md')
  })

  test('infers hard exact successful Edit budgets only from mandatory wording', () => {
    expect(
      inferBenchmarkExactSuccessfulEditBudget(
        'Fix the bug with exactly one focused Edit, then verify.',
      ),
    ).toBe(1)
    expect(
      inferBenchmarkExactSuccessfulEditBudget(
        'Fix both failures with exactly two sequential source Edits, then verify.',
      ),
    ).toBe(2)
    expect(
      inferBenchmarkExactSuccessfulEditBudget(
        'Patch src/html.js with one focused Edit and rerun tests.',
      ),
    ).toBe(1)
    expect(
      inferBenchmarkExactSuccessfulEditBudget(
        'Prefer one focused Edit. If the first verification fails, a correction is allowed.',
      ),
    ).toBeUndefined()
    expect(
      inferBenchmarkExactSuccessfulEditBudget(
        'Use one focused Edit or Write, rerun bun test immediately after the successful edit.',
      ),
    ).toBeUndefined()
  })

  test('locks V8 review fix to one Edit after reading source and test expectations', () => {
    const reviewCase = getBenchmarkCaseForTest('v8-real-review-fix')
    expect(reviewCase?.prompt).toContain('read both src/html.js and test/html.test.js')
    expect(reviewCase?.prompt).toContain('expected single-quote entity from the test')
    expect(
      inferBenchmarkExactSuccessfulEditBudget(reviewCase?.prompt ?? ''),
    ).toBe(1)
  })

  test('flags Bash native verification as invalid for model-forced bare baselines only', () => {
    expect(
      hasModelForcedBareBashVerificationViolation({
        baselineProfile: 'model_forced_bare',
        semanticToolsEnabled: false,
        metrics: { bashNativeVerificationCalls: 1 },
      }),
    ).toBe(true)
    expect(
      hasModelForcedBareBashVerificationViolation({
        baselineProfile: 'model_forced_bare',
        semanticToolsEnabled: true,
        metrics: { bashNativeVerificationCalls: 1 },
      }),
    ).toBe(false)
    expect(
      hasModelForcedBareBashVerificationViolation({
        baselineProfile: null,
        semanticToolsEnabled: false,
        metrics: { bashNativeVerificationCalls: 1 },
      }),
    ).toBe(false)
  })

  test('flags noncanonical verification and visibility gates as invalid bare baseline evidence', () => {
    expect(
      getModelForcedBarePolicyViolations({
        baselineProfile: 'model_forced_bare',
        semanticToolsEnabled: false,
        metrics: {
          bashNativeVerificationCalls: 0,
          nonCanonicalPowerShellNativeVerificationCalls: 1,
          executionVisibilityGateCount: 1,
        },
      }),
    ).toEqual([
      'noncanonical_powershell_verification',
      'execution_visibility_gate',
    ])
    expect(
      getModelForcedBarePolicyViolations({
        baselineProfile: 'model_forced_bare',
        semanticToolsEnabled: false,
        metrics: {
          bashNativeVerificationCalls: 0,
          nonCanonicalPowerShellNativeVerificationCalls: 0,
          executionVisibilityGateCount: 0,
        },
      }),
    ).toEqual([])
  })

  test('detects prompts that require native test verification before discovery', () => {
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Run the tests first, inspect only this fixture, then patch the bug.',
      ),
    ).toBe(true)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Start by running bun test, diagnose the failing retry logic, patch it.',
      ),
    ).toBe(true)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Run bun test first from the fixture path, then patch the bug.',
      ),
    ).toBe(true)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Run bun test with PowerShell first. Read the files after that.',
      ),
    ).toBe(true)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Run the failing test, preserve the failed command, then repair.',
      ),
    ).toBe(true)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Run native PowerShell bun test and preserve the failing command. Then patch the issue.',
      ),
    ).toBe(true)
    expect(getBenchmarkCaseForTest('product-review-to-fix-live')).toMatchObject({
      requirePreEditBaselineVerification: true,
    })
    expect(getBenchmarkCaseForTest('product-second-failure-recovery-live')).toMatchObject({
      requirePreEditBaselineVerification: true,
    })
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Add a small exported helper with tests, verify it, and finish.',
      ),
    ).toBe(false)
    expect(
      benchmarkCaseRequiresInitialNativeVerification(
        'Patch the issue, then run bun test to verify the finished fix.',
      ),
    ).toBe(false)
  })

  test('model-forced bare fixture baselines prefer PowerShell over Bash without changing normal runs', () => {
    expect(
      normalizeBenchmarkAllowedTools('Read,Edit,Write,Bash,PowerShell,Grep,Glob', {
        modelForcedBareBaseline: true,
        hasWorkTarget: true,
      }),
    ).toBe('Read,Edit,Write,PowerShell,Grep,Glob')
    expect(
      normalizeBenchmarkAllowedTools('Read,Edit,Write,Bash,PowerShell,Grep,Glob', {
        modelForcedBareBaseline: false,
        hasWorkTarget: true,
      }),
    ).toBe('Read,Edit,Write,Bash,PowerShell,Grep,Glob')
    expect(
      normalizeBenchmarkAllowedTools('Read,Edit,Bash,Grep', {
        modelForcedBareBaseline: true,
        hasWorkTarget: true,
      }),
    ).toBe('Read,Edit,Bash,Grep')
  })

  test('renders case-specific PowerShell and final marker hard contracts', () => {
    expect(
      renderBenchmarkPowerShellVerificationContract('D:\\fixture'),
    ).toContain('Set-Location "D:\\fixture"; bun test')
    expect(
      renderBenchmarkPowerShellVerificationContract('D:\\fixture'),
    ).toContain('Never type 2>&1')
    expect(
      renderBenchmarkFinalMarkerContract('DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS'),
    ).toContain(
      'exactly DSXU_BENCH_PRODUCT_FEATURE_TESTS_PASS and nothing else',
    )
  })
})
