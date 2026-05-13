import { describe, expect, test } from 'bun:test';
import { createToolMainlineRuntime } from '../runtime-core';
import {
  buildDsxuToolEvidencePack,
  projectToolEvidenceForFinalReport,
  renderDsxuToolEvidencePackSummary,
  validateDsxuToolEvidencePack,
} from '../tool-evidence-pack-v1';
import { evaluateToolGate } from '../tool-gate-v1';
import type { ToolDefinition, ToolPermissionContext } from '../tool-types-v1';

function tool(partial: Partial<ToolDefinition> & Pick<ToolDefinition, 'toolId'>): ToolDefinition {
  return {
    toolId: partial.toolId,
    metadata: partial.metadata || {
      displayName: partial.toolId,
      description: partial.toolId,
      owner: 'dsxu-mainline',
      version: '1.0.0',
      tags: ['mainline'],
    },
    capabilityTags: partial.capabilityTags || ['execute'],
    executionMode: partial.executionMode || 'sync',
    permissionLevel: partial.permissionLevel || 'safe',
    readWriteClass: partial.readWriteClass || 'read-only',
    sideEffectClass: partial.sideEffectClass || 'none',
    failureClass: partial.failureClass || 'unknown',
    inputContract: partial.inputContract || { schemaRef: 'in', requiredFields: [], optionalFields: [], validationNotes: [] },
    outputContract: partial.outputContract || { schemaRef: 'out', producedFields: ['content'], failureFields: ['isError'], stabilityNotes: [] },
    constraints: partial.constraints || [],
  };
}

function context(patch?: Partial<ToolPermissionContext>): ToolPermissionContext {
  return {
    actorId: 'tester',
    sessionId: `tool-evidence-test-${Date.now()}`,
    cwd: process.cwd(),
    allowedPermissionLevel: 'guarded',
    requireConfirmationForWrite: false,
    denyRules: [],
    ...patch,
  };
}

describe('WP-01 - Tool Evidence Pack contract', () => {
  test('1. builder records the standard tool evidence fields and lifecycle', () => {
    const readTool = tool({ toolId: 'Read', capabilityTags: ['search'], readWriteClass: 'read-only' });
    const gate = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    const pack = buildDsxuToolEvidencePack({
      queryTurnId: 'turn-1',
      originalToolId: 'FileReadTool',
      resolvedToolId: 'Read',
      capabilityTags: readTool.capabilityTags,
      readWriteClass: readTool.readWriteClass,
      permission: { allowed: true, reason: 'allowed' },
      gate,
      result: { toolUseId: 'tool-1', content: 'ok', isError: false },
      now: 1,
    });

    expect(pack.schemaVersion).toBe('dsxu.tool-evidence-pack.v1');
    expect(pack.originalToolId).toBe('FileReadTool');
    expect(pack.resolvedToolId).toBe('Read');
    expect(pack.resultStatus).toBe('success');
    expect(pack.visibleState).toBe('completed');
    expect(pack.traceId).toBe(gate.approvalTrace.traceId);
    expect(pack.lifecycle.map((event) => event.event)).toContain('tool_execution_completed');
    expect(validateDsxuToolEvidencePack(pack).valid).toBeTrue();
  });

  test('2. blocked tools still produce evidence, recovery hint, and trace', () => {
    const writeTool = tool({
      toolId: 'Write',
      capabilityTags: ['write'],
      permissionLevel: 'guarded',
      readWriteClass: 'write-local',
      sideEffectClass: 'local-state',
    });
    const gate = evaluateToolGate(writeTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });
    const pack = buildDsxuToolEvidencePack({
      queryTurnId: 'turn-2',
      originalToolId: 'FileWriteTool',
      resolvedToolId: 'Write',
      capabilityTags: writeTool.capabilityTags,
      readWriteClass: writeTool.readWriteClass,
      permission: { allowed: false, reason: 'write confirmation required' },
      gate,
      now: 2,
    });

    expect(pack.resultStatus).toBe('blocked');
    expect(pack.permissionDecision).toBe('denied');
    expect(pack.recoveryHint.length).toBeGreaterThan(0);
    expect(pack.lifecycle.map((event) => event.event)).toContain('tool_recovery_planned');
    expect(validateDsxuToolEvidencePack(pack).valid).toBeTrue();
  });

  test('3. mainline alias execution preserves original and resolved tool identity', async () => {
    const runtime = createToolMainlineRuntime();
    const out = await runtime.executeToolMainline({
      toolId: 'SkillTool',
      input: { agentTaskId: 'skill-task-1', message: 'select skill owner' },
      context: context({ sessionId: 'tool-evidence-alias' }),
    });

    expect(out.allowed).toBeTrue();
    expect(out.evidencePack.originalToolId).toBe('SkillTool');
    expect(out.evidencePack.resolvedToolId).toBe('AgentTool');
    expect(out.evidencePack.resultStatus).toBe('success');
    expect(out.evidencePack.lifecycle.map((event) => event.event)).toContain('tool_postflight_recorded');
    expect(validateDsxuToolEvidencePack(out.evidencePack).valid).toBeTrue();
  });

  test('4. mainline-managed service path records the same evidence contract', async () => {
    const runtime = createToolMainlineRuntime();
    const out = await runtime.executeToolMainline({
      toolId: 'WorkflowTool',
      input: { workflowId: 'wp-01', action: 'plan' },
      context: context({ sessionId: 'tool-evidence-managed-service' }),
    });

    expect(out.allowed).toBeTrue();
    expect(out.evidencePack.originalToolId).toBe('WorkflowTool');
    expect(out.evidencePack.resolvedToolId).toBe('WorkflowTool');
    expect(out.evidencePack.resultStatus).toBe('success');
    expect(validateDsxuToolEvidencePack(out.evidencePack).valid).toBeTrue();
  });

  test('5. permission denial through mainline still returns evidence', async () => {
    const runtime = createToolMainlineRuntime();
    const out = await runtime.executeToolMainline({
      toolId: 'Read',
      input: { file_path: __filename, offset: 1, limit: 1 },
      context: context({
        sessionId: 'tool-evidence-denied',
        allowedPermissionLevel: 'safe',
        denyRules: [{ ruleId: 'deny-read', toolIdPattern: 'Read', reason: 'contract denial check' }],
      }),
    });

    expect(out.allowed).toBeFalse();
    expect(out.evidencePack.resultStatus).toBe('blocked');
    expect(out.evidencePack.permissionDecision).toBe('denied');
    expect(out.evidencePack.visibleState).toBe('denied');
    expect(out.evidencePack.traceId.length).toBeGreaterThan(0);
    expect(validateDsxuToolEvidencePack(out.evidencePack).valid).toBeTrue();
  });

  test('6. final-report projection carries status, permission, gate, trace, and artifacts', () => {
    const readTool = tool({ toolId: 'Read', capabilityTags: ['search'], readWriteClass: 'read-only' });
    const gate = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    const pack = buildDsxuToolEvidencePack({
      queryTurnId: 'turn-3',
      originalToolId: 'Read',
      resolvedToolId: 'Read',
      capabilityTags: readTool.capabilityTags,
      readWriteClass: readTool.readWriteClass,
      permission: { allowed: true, reason: 'allowed' },
      gate,
      result: { toolUseId: 'tool-3', content: 'ok', isError: false },
      artifactPaths: ['docs/evidence/tool-3.json'],
      now: 3,
    });

    const projected = projectToolEvidenceForFinalReport(pack);
    expect(projected.status).toBe('success');
    expect(projected.permission).toBe('granted');
    expect(projected.gate).toBe('allow');
    expect(projected.traceId).toBe(pack.traceId);
    expect(projected.artifacts).toEqual(['docs/evidence/tool-3.json']);
    expect(renderDsxuToolEvidencePackSummary(pack)).toContain('status=success');
  });
});
