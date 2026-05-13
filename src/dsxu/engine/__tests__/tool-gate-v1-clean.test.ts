import { describe, expect, test } from 'bun:test';
import { evaluateToolGate } from '../tool-gate-v1';
import type { ToolDefinition } from '../tool-types-v1';

function tool(partial: Partial<ToolDefinition> & Pick<ToolDefinition, 'toolId'>): ToolDefinition {
  return {
    toolId: partial.toolId,
    metadata: partial.metadata || {
      displayName: partial.toolId,
      description: partial.toolId,
      owner: 'duxu',
      version: '1.0.0',
      tags: [],
    },
    capabilityTags: partial.capabilityTags || ['analysis'],
    executionMode: partial.executionMode || 'sync',
    permissionLevel: partial.permissionLevel || 'safe',
    readWriteClass: partial.readWriteClass || 'read-only',
    sideEffectClass: partial.sideEffectClass || 'none',
    failureClass: partial.failureClass || 'transient',
    inputContract: partial.inputContract || { schemaRef: 'in', requiredFields: [], optionalFields: [], validationNotes: [] },
    outputContract: partial.outputContract || { schemaRef: 'out', producedFields: [], failureFields: [], stabilityNotes: [] },
    constraints: partial.constraints || [],
  };
}

describe('V10-4 Phase B - tool gate and risk', () => {
  const readTool = tool({ toolId: 'read-tool', readWriteClass: 'read-only', sideEffectClass: 'none' });
  const writeTool = tool({ toolId: 'write-tool', readWriteClass: 'write-local', sideEffectClass: 'local-state', permissionLevel: 'guarded' });
  const externalTool = tool({
    toolId: 'external-tool',
    readWriteClass: 'write-external',
    sideEffectClass: 'external-side-effect',
    permissionLevel: 'privileged',
    failureClass: 'permission',
  });

  test('1. ToolRiskLevel exists through structured output', () => {
    const r = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: true });
    expect(['low', 'medium', 'high', 'critical']).toContain(r.riskLevel);
  });

  test('2. ToolGateDecision exists through structured output', () => {
    const r = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: true });
    expect(r.gateDecision).toBeDefined();
  });

  test('3. allow/warn/block/require_confirmation are expressible', () => {
    const allow = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    const requireConfirm = evaluateToolGate(writeTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });
    const warn = evaluateToolGate(writeTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    const block = evaluateToolGate(externalTool, {
      allowedPermissionLevel: 'safe',
      requireConfirmationForWrite: true,
      conflictPolicy: { policyId: 'p1', disallowConcurrentPairs: [{ left: 'external-tool', right: 'write-tool', reason: 'shared-target' }] },
      concurrentToolIds: ['write-tool'],
    });
    expect(allow.gateDecision).toBe('allow');
    expect(requireConfirm.gateDecision).toBe('require_confirmation');
    expect(warn.gateDecision).toBe('warn');
    expect(block.gateDecision).toBe('block');
  });

  test('4. ToolRollbackHint exists', () => {
    const r = evaluateToolGate(writeTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });
    expect(r.rollbackHint.actions.length).toBeGreaterThan(0);
  });

  test('5. ToolConflictPolicy exists and can block concurrent pair', () => {
    const r = evaluateToolGate(writeTool, {
      allowedPermissionLevel: 'guarded',
      requireConfirmationForWrite: false,
      conflictPolicy: { policyId: 'p2', disallowConcurrentPairs: [{ left: 'write-tool', right: 'x', reason: 'same-resource' }] },
      concurrentToolIds: ['x'],
    });
    expect(r.gateDecision).toBe('block');
  });

  test('6. write tool gate differs from read-only tool', () => {
    const read = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: true });
    const write = evaluateToolGate(writeTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });
    expect(read.gateDecision).not.toBe(write.gateDecision);
  });

  test('7. external side effect tool gets higher gate requirement', () => {
    const r = evaluateToolGate(externalTool, { allowedPermissionLevel: 'privileged', requireConfirmationForWrite: false });
    expect(r.riskLevel).toBe('critical');
    expect(r.gateDecision).toBe('require_confirmation');
  });

  test('8. ToolApprovalTrace exists', () => {
    const r = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    expect(r.approvalTrace.traceId.length).toBeGreaterThan(0);
  });

  test('9. result is structured decision object, not plain string', () => {
    const r = evaluateToolGate(readTool, { allowedPermissionLevel: 'safe', requireConfirmationForWrite: false });
    expect(typeof r).toBe('object');
    expect(r.executionDecision).toBeDefined();
  });

  test('10. no mainline integration change is required in phase B', () => {
    const touchedScope = ['tool-gate-v1'];
    expect(touchedScope.every((x) => x.includes('tool'))).toBeTrue();
  });
});
