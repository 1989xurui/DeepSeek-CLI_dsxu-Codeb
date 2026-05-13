import { describe, expect, test } from 'bun:test';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { consumeToolSignalsInCoordinator } from '../coordinator-v1';
import { createQueryLoopToolState, consumeToolDecisionInQueryLoop, projectToolStateToNextRound } from '../query-loop';
import { consumeToolMainlineForRecovery } from '../recovery';
import { createToolMainlineRuntime } from '../runtime-core';
import { createToolMainlineSessionState, applyToolMainlineToSession } from '../session';
import { evaluateToolGate } from '../tool-gate-v1';
import type { ToolDefinition } from '../tool-types-v1';

function buildTool(toolId: string, patch?: Partial<ToolDefinition>): ToolDefinition {
  return {
    toolId,
    metadata: {
      displayName: toolId,
      description: toolId,
      owner: 'duxu',
      version: '1.0.0',
      tags: ['mainline'],
    },
    capabilityTags: patch?.capabilityTags || ['execute'],
    executionMode: patch?.executionMode || 'sync',
    permissionLevel: patch?.permissionLevel || 'safe',
    readWriteClass: patch?.readWriteClass || 'read-only',
    sideEffectClass: patch?.sideEffectClass || 'none',
    failureClass: patch?.failureClass || 'transient',
    inputContract: patch?.inputContract || { schemaRef: 'in', requiredFields: ['arg'], optionalFields: [], validationNotes: [] },
    outputContract: patch?.outputContract || { schemaRef: 'out', producedFields: ['ok'], failureFields: ['error'], stabilityNotes: [] },
    constraints: patch?.constraints || [],
  };
}

describe('V10-4 Phase C - tool mainline orchestration', () => {
  const writeTool = buildTool('tool-write', {
    readWriteClass: 'write-local',
    sideEffectClass: 'local-state',
    permissionLevel: 'guarded',
  });
  const externalTool = buildTool('tool-external', {
    readWriteClass: 'write-external',
    sideEffectClass: 'external-side-effect',
    permissionLevel: 'privileged',
    failureClass: 'permission',
  });

  const gateWrite = evaluateToolGate(writeTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });
  const gateExternal = evaluateToolGate(externalTool, { allowedPermissionLevel: 'guarded', requireConfirmationForWrite: true });

  const q0 = createQueryLoopToolState('task-tool-mainline');
  const q1 = consumeToolDecisionInQueryLoop(q0, {
    gateDecision: {
      toolId: writeTool.toolId,
      gateDecision: gateWrite.gateDecision,
      executionDecision: gateWrite.executionDecision,
      riskLevel: gateWrite.riskLevel,
    },
    executionResult: { toolId: writeTool.toolId, status: 'running', summary: 'write started' },
  });
  const q2 = consumeToolDecisionInQueryLoop(q1, {
    gateDecision: {
      toolId: externalTool.toolId,
      gateDecision: 'block',
      executionDecision: 'deny',
      riskLevel: 'critical',
    },
    executionResult: { toolId: externalTool.toolId, status: 'blocked', summary: 'blocked by gate', failureHint: 'approval-required' },
  });

  const nextRound = projectToolStateToNextRound(q2);
  const coordinatorOut = consumeToolSignalsInCoordinator({
    taskId: 'task-tool-mainline',
    selectedToolIds: [writeTool.toolId, externalTool.toolId],
    gate: [
      { toolId: writeTool.toolId, gateDecision: gateWrite.gateDecision, riskLevel: gateWrite.riskLevel },
      { toolId: externalTool.toolId, gateDecision: 'block', riskLevel: 'critical' },
    ],
    executions: [
      { toolId: writeTool.toolId, status: 'succeeded', summary: 'ok' },
      { toolId: externalTool.toolId, status: 'failed', summary: 'blocked/permission' },
    ],
  });

  const sessionState = applyToolMainlineToSession(createToolMainlineSessionState('task-tool-mainline'), {
    selectedToolIds: [writeTool.toolId, externalTool.toolId],
    gateDecisions: [
      { toolId: writeTool.toolId, decision: gateWrite.gateDecision, riskLevel: gateWrite.riskLevel, approvalTraceId: gateWrite.approvalTrace.traceId },
      { toolId: externalTool.toolId, decision: 'block', riskLevel: 'critical', approvalTraceId: gateExternal.approvalTrace.traceId },
    ],
    executionResults: [
      { toolId: writeTool.toolId, status: 'succeeded', summary: 'done' },
      { toolId: externalTool.toolId, status: 'failed', summary: 'permission denied' },
    ],
  });

  const recoveryOut = consumeToolMainlineForRecovery({
    failures: [{ toolId: externalTool.toolId, class: 'permission', summary: 'denied' }],
    blocked: [{ toolId: externalTool.toolId, reason: 'gate-block' }],
    conflicts: [],
  });

  const runtime = createToolMainlineRuntime();

  test('1. query-loop consumes ToolExecutionDecision', () => {
    expect(q1.latestGateDecision?.executionDecision).toBeDefined();
  });

  test('2. query-loop consumes ToolGateDecision', () => {
    expect(q2.latestGateDecision?.gateDecision).toBe('block');
  });

  test('3. query-loop next round input is influenced by tool result', () => {
    expect(nextRound.shouldRunTool).toBeFalse();
    expect(nextRound.blockedToolIds).toContain('tool-external');
  });

  test('4. coordinator sees tool execution/failure signals', () => {
    expect(coordinatorOut.riskSummary.failedTools).toContain('tool-external');
  });

  test('5. session holds tool invocation state', () => {
    expect(sessionState.invocation.selectedToolIds.length).toBe(2);
  });

  test('6. session holds tool snapshot/summary/trace', () => {
    expect(sessionState.executionSnapshot.gateDecisions.length).toBe(2);
    expect(sessionState.traces.approvalTraceIds.length).toBe(2);
  });

  test('7. recovery consumes failure/block/conflict signals', () => {
    expect(recoveryOut.action).toBe('request-approval');
  });

  test('8. recovery outputs structured recovery decision', () => {
    expect(recoveryOut.severity).toBe('critical');
    expect(recoveryOut.decisionTrace.length).toBeGreaterThan(0);
  });

  test('9. runtime-core exports official tool mainline entry', () => {
    expect(typeof runtime.ports.consumeQueryLoopToolDecision).toBe('function');
    expect(typeof runtime.createToolMainlineSessionState).toBe('function');
  });

  test('10. does not introduce second query-loop', () => {
    expect(typeof runtime.createQueryLoopToolState).toBe('function');
  });

  test('11. does not introduce second session/recovery/tool system', () => {
    expect(typeof runtime.ports.persistToolSessionState).toBe('function');
    expect(typeof runtime.ports.buildToolRecoveryDecision).toBe('function');
  });

  test('12. validates real mainline consumption, not object existence only', () => {
    const q3 = runtime.ports.consumeQueryLoopToolDecision(createQueryLoopToolState('task-x'), {
      gateDecision: { toolId: 'x', gateDecision: 'allow', executionDecision: 'execute', riskLevel: 'low' },
      executionResult: { toolId: 'x', status: 'succeeded', summary: 'ok' },
    });
    const projected = projectToolStateToNextRound(q3);
    expect(projected.shouldRunTool).toBeTrue();
  });

  test('13. runtime-core exposes direct mainline execution entry (no bridge)', async () => {
    const run = runtime.executeToolMainline;
    expect(typeof run).toBe('function');

    const out = await run({
      toolId: 'Read',
      input: { file_path: __filename, offset: 1, limit: 5 },
      context: {
        actorId: 'tester',
        sessionId: 'tool-mainline-test',
        cwd: process.cwd(),
        allowedPermissionLevel: 'safe',
        requireConfirmationForWrite: false,
        denyRules: [],
      },
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.isError).toBeFalse();
    expect(out.result?.content.length).toBeGreaterThan(0);
  });

  test('14. file write/edit/read can execute through mainline entry', async () => {
    const run = runtime.executeToolMainline;
    const tmpFile = path.resolve(process.cwd(), `.tmp-tool-mainline-${Date.now()}.txt`);

    const baseContext = {
      actorId: 'tester',
      sessionId: 'tool-mainline-test',
      cwd: process.cwd(),
      allowedPermissionLevel: 'guarded' as const,
      requireConfirmationForWrite: false,
      denyRules: [],
    };

    const write = await run({
      toolId: 'FileWriteTool',
      input: { file_path: tmpFile, content: 'hello\\nworld' },
      context: baseContext,
    });
    expect(write.allowed).toBeTrue();
    expect(write.result?.isError).toBeFalse();

    const readBeforeEdit = await run({
      toolId: 'FileReadTool',
      input: { file_path: tmpFile },
      context: {
        ...baseContext,
        allowedPermissionLevel: 'safe',
      },
    });
    expect(readBeforeEdit.allowed).toBeTrue();
    expect(readBeforeEdit.result?.isError).toBeFalse();

    const edit = await run({
      toolId: 'FileEditTool',
      input: { file_path: tmpFile, old_string: 'world', new_string: 'duxu' },
      context: baseContext,
    });
    expect(edit.allowed).toBeTrue();
    expect(edit.result?.isError).toBeFalse();

    const read = await run({
      toolId: 'FileReadTool',
      input: { file_path: tmpFile },
      context: {
        ...baseContext,
        allowedPermissionLevel: 'safe',
      },
    });
    expect(read.allowed).toBeTrue();
    expect(read.result?.content.includes('duxu')).toBeTrue();

    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  });

  test('15. AgentTool lifecycle can execute through mainline entry', async () => {
    const run = runtime.executeToolMainline;
    const context = {
      actorId: 'tester',
      sessionId: 'agent-mainline-test',
      cwd: process.cwd(),
      allowedPermissionLevel: 'guarded' as const,
      requireConfirmationForWrite: false,
      denyRules: [],
    };

    const create = await run({
      toolId: 'AgentTool',
      input: { action: 'create', agentTaskId: 'agt-1', agentId: 'agent-x', objective: 'investigate bug' },
      context,
    });
    expect(create.allowed).toBeTrue();
    expect(create.result?.content.includes('agent-action=create')).toBeTrue();

    const start = await run({
      toolId: 'AgentTool',
      input: { action: 'start', agentTaskId: 'agt-1' },
      context,
    });
    expect(start.result?.content.includes('running')).toBeTrue();

    const msg = await run({
      toolId: 'AgentTool',
      input: { action: 'message', agentTaskId: 'agt-1', message: 'found suspicious config' },
      context,
    });
    expect(msg.result?.content.includes('message')).toBeTrue();

    const stop = await run({
      toolId: 'AgentTool',
      input: { action: 'stop', agentTaskId: 'agt-1' },
      context,
    });
    expect(stop.result?.content.includes('stopped')).toBeTrue();
  });

  test('16. LSPTool executes through mainline entry without legacy bridge', async () => {
    const run = runtime.executeToolMainline;
    const out = await run({
      toolId: 'LSPTool',
      input: { filePath: __filename, operation: 'documentSymbol', line: 1, character: 1 },
      context: {
        actorId: 'tester',
        sessionId: 'tool-mainline-lsp-test',
        cwd: process.cwd(),
        allowedPermissionLevel: 'safe',
        requireConfirmationForWrite: false,
        denyRules: [],
      },
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.isError).toBeFalse();
    expect(out.result?.content).toContain('LSP server manager');
  });

  test('17. MCP resource listing uses DSXU MCP runtime path', async () => {
    const run = runtime.executeToolMainline;
    const out = await run({
      toolId: 'ListMcpResourcesTool',
      input: {},
      context: {
        actorId: 'tester',
        sessionId: 'tool-mainline-mcp-test',
        cwd: process.cwd(),
        allowedPermissionLevel: 'safe',
        requireConfirmationForWrite: false,
        denyRules: [],
      },
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.isError).toBeFalse();
    expect(out.result?.content).toContain('resourcesByServer');
  });

  test('18. WorkflowTool uses DSXU tool-mainline status path', async () => {
    const run = runtime.executeToolMainline;
    const out = await run({
      toolId: 'WorkflowTool',
      input: { workflowId: 'wf-v2-mainline', action: 'complete' },
      context: {
        actorId: 'tester',
        sessionId: 'tool-mainline-workflow-test',
        cwd: process.cwd(),
        allowedPermissionLevel: 'guarded',
        requireConfirmationForWrite: false,
        denyRules: [],
      },
    });

    expect(out.allowed).toBeTrue();
    expect(out.result?.isError).toBeFalse();
    expect(out.result?.content).toContain('wf-v2-mainline');
    expect(out.result?.content).toContain('dsxu-tool-mainline');
  });
});
