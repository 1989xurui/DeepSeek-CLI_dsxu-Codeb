import { describe, expect, test } from 'bun:test';
import {
  buildDsxuContextOwnerRuleDecision,
  buildDsxuContextOwnerRuleFromResume,
  validateDsxuContextOwnerRuleDecision,
} from '../context-owner-rule-v1';
import {
  buildDsxuLocalMemoryReadOnlyBundle,
  buildDsxuSmoothResumePlan,
  createDsxuTaskStateSnapshot,
  type DsxuLocalMemoryEntry,
} from '../task-governance';

const memoryEntry: DsxuLocalMemoryEntry = {
  id: 'mem-app-entry',
  kind: 'project_fact',
  title: 'App entry file',
  content: 'The app entry is src/App.tsx.',
  sourcePath: '.dsxu/memory/app-entry.json',
  createdAt: '2026-05-12T00:00:00.000Z',
  confidence: 0.95,
  deletablePath: '.dsxu/memory/app-entry.json',
  relatedFiles: ['src/App.tsx'],
};

describe('WP-02 - Context Owner Rule contract', () => {
  test('1. owner map fixes source, edit target, verification, memory, snapshot, and tool evidence roles', () => {
    const decision = buildDsxuContextOwnerRuleDecision({
      goal: 'repair app',
      currentSourceFiles: ['src/App.tsx'],
      verificationStatus: 'unknown',
    });

    expect(decision.sourceTruthOwner).toBe('current_source_files');
    expect(decision.editTargetOwner).toBe('current_source_files');
    expect(decision.verificationOwner).toBe('latest_verification_output');
    expect(decision.memoryOwner).toBe('memory_hint');
    expect(decision.snapshotOwner).toBe('compact_snapshot');
    expect(decision.toolEvidenceOwner).toBe('tool_evidence');
    expect(decision.memoryMaySelectEditTarget).toBe(false);
    expect(decision.memoryMayClaimPass).toBe(false);
    expect(validateDsxuContextOwnerRuleDecision(decision).valid).toBeTrue();
  });

  test('2. resume with overlapping memory requires reread before edit and blocks PASS before verification', () => {
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'resume bugfix',
      scope: 'src only',
      filesRead: ['src/App.tsx'],
      filesChanged: ['src/App.tsx'],
      failedCommands: ['bun test src/app.test.ts'],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: ['finish bugfix'],
      workflowPreferencesApplied: [],
      nextAction: 'repair then verify',
      verificationStatus: 'failed',
      createdAt: '2026-05-12T00:10:00.000Z',
    });
    const memory = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [memoryEntry],
      currentSourceFiles: ['src/App.tsx'],
    });
    const decision = buildDsxuContextOwnerRuleFromResume({ snapshot, memory });

    expect(decision.mayEdit).toBe(false);
    expect(decision.mayClaimPass).toBe(false);
    expect(decision.requiredBeforeEdit.join('\n')).toContain('src/App.tsx');
    expect(decision.requiredBeforePass.join('\n')).toContain('bun test src/app.test.ts');
    expect(decision.blockReasons).toContain('source_truth_not_reread_after_resume');
    expect(decision.blockReasons).toContain('failed_command_unresolved');
    expect(validateDsxuContextOwnerRuleDecision(decision).valid).toBeTrue();
  });

  test('3. source reread allows edit, but PASS still requires post-resume verification evidence', () => {
    const decision = buildDsxuContextOwnerRuleDecision({
      goal: 'continue feature',
      currentSourceFiles: ['src/App.tsx'],
      filesChanged: ['src/App.tsx'],
      rereadFiles: ['src/App.tsx'],
      sourceTruthRefreshRequired: true,
      sourceTruthRereadAfterResume: true,
      verificationStatus: 'passed',
      verificationEvidenceAfterResume: false,
    });

    expect(decision.mayEdit).toBe(true);
    expect(decision.mayClaimPass).toBe(false);
    expect(decision.blockReasons).toContain('verification_not_rerun_after_resume');
    expect(decision.requiredBeforePass.join('\n')).toContain('Record verification output after resume');
  });

  test('4. PASS is allowed only after current source reread and latest verification output', () => {
    const decision = buildDsxuContextOwnerRuleDecision({
      goal: 'finalize patch',
      currentSourceFiles: ['src/App.tsx'],
      filesChanged: ['src/App.tsx'],
      rereadFiles: ['src/App.tsx'],
      sourceTruthRefreshRequired: true,
      sourceTruthRereadAfterResume: true,
      verificationStatus: 'passed',
      verificationEvidenceAfterResume: true,
      failedCommands: [],
      permissionDenials: [],
      toolEvidenceTraceIds: ['tool-approval-1'],
      memoryEntryIds: ['mem-app-entry'],
    });

    expect(decision.mayEdit).toBe(true);
    expect(decision.mayClaimPass).toBe(true);
    expect(decision.blockReasons).toEqual([]);
    expect(decision.trace.join('\n')).toContain('toolEvidenceTraceIds=1');
    expect(validateDsxuContextOwnerRuleDecision(decision).valid).toBeTrue();
  });

  test('5. smooth resume plan exposes the same owner rule and keeps memory out of edit/PASS ownership', () => {
    const snapshot = createDsxuTaskStateSnapshot({
      goal: 'resume after compact',
      scope: 'src only',
      filesRead: ['src/App.tsx'],
      filesChanged: ['src/App.tsx'],
      failedCommands: [],
      permissionDenials: [],
      activeAgents: [],
      pendingTasks: [],
      workflowPreferencesApplied: [],
      nextAction: 'verify after reread',
      verificationStatus: 'passed',
      createdAt: '2026-05-12T00:20:00.000Z',
    });
    const memory = buildDsxuLocalMemoryReadOnlyBundle({
      entries: [memoryEntry],
      currentSourceFiles: ['src/App.tsx'],
    });
    const plan = buildDsxuSmoothResumePlan({ snapshot, memory });

    expect(plan.ownerRule.schemaVersion).toBe('dsxu.context-owner-rule.v1');
    expect(plan.ownerRule.memoryMaySelectEditTarget).toBe(false);
    expect(plan.ownerRule.memoryMayClaimPass).toBe(false);
    expect(plan.mayEditFromMemory).toBe(false);
    expect(plan.mayClaimPass).toBe(false);
    expect(plan.rendered).toContain('Context Owner Rule');
  });
});
