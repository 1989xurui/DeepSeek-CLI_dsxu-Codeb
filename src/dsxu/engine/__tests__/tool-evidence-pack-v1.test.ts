import { describe, expect, test } from 'bun:test'
import {
  buildDsxuToolEvidencePack,
  projectToolEvidenceForFinalReport,
  validateDsxuToolEvidencePack,
} from '../tool-evidence-pack-v1'
import { evaluateToolGate, evaluateToolPermissionContext } from '../tool-gate-v1'
import type { ToolDefinition, ToolPermissionContext } from '../tool-types-v1'

const editTool: ToolDefinition = {
  toolId: 'Edit',
  metadata: {
    displayName: 'Edit',
    description: 'Edit a local source file',
    owner: 'Tool Gate',
    version: 'v1',
    tags: ['edit'],
  },
  capabilityTags: ['edit'],
  executionMode: 'sync',
  permissionLevel: 'guarded',
  readWriteClass: 'write-local',
  sideEffectClass: 'local-state',
  failureClass: 'deterministic',
  inputContract: {
    schemaRef: 'dsxu.tool-input.edit.v1',
    requiredFields: ['filePath'],
    optionalFields: ['oldString', 'newString'],
    validationNotes: [],
  },
  outputContract: {
    schemaRef: 'dsxu.tool-call-result.v1',
    producedFields: ['content'],
    failureFields: ['isError'],
    stabilityNotes: ['Normalized by Tool Gate'],
  },
  constraints: [],
}

const permissionContext: ToolPermissionContext = {
  actorId: 'tester',
  sessionId: 'session-tool-evidence',
  cwd: process.cwd(),
  allowedPermissionLevel: 'guarded',
  requireConfirmationForWrite: false,
  denyRules: [],
}

describe('DSXU tool evidence pack canonical contract', () => {
  test('attaches canonical ToolCallResult contract evidence to executed tool packs', () => {
    const permission = evaluateToolPermissionContext(editTool, permissionContext)
    const gate = evaluateToolGate(editTool, {
      allowedPermissionLevel: permissionContext.allowedPermissionLevel,
      requireConfirmationForWrite: permissionContext.requireConfirmationForWrite,
    })
    const pack = buildDsxuToolEvidencePack({
      queryTurnId: 'turn-tool-evidence',
      originalToolId: 'Edit',
      resolvedToolId: 'Edit',
      capabilityTags: editTool.capabilityTags,
      readWriteClass: editTool.readWriteClass,
      permission,
      gate,
      result: {
        toolUseId: 'toolu-edit-evidence',
        content: 'edited src/example.ts',
        isError: false,
      },
      now: 1_000,
    })

    expect(pack.resultStatus).toBe('success')
    expect(pack.canonicalResultSchema).toBe('dsxu.tool-call-result.v1')
    expect(pack.runtimeEventSchema).toBe('dsxu.runtime-event.v1')
    expect(pack.toolResultBoundaryKind).toBe('legacy')
    expect(pack.toolResultOutputChars).toBe('edited src/example.ts'.length)
    expect(pack.toolResultContractEvidence?.owner).toBe('Tool Gate')
    expect(validateDsxuToolEvidencePack(pack)).toEqual({
      valid: true,
      missingFields: [],
      violations: [],
    })
    expect(projectToolEvidenceForFinalReport(pack)).toMatchObject({
      canonicalResultSchema: 'dsxu.tool-call-result.v1',
      runtimeEventSchema: 'dsxu.runtime-event.v1',
      toolResultBoundaryKind: 'legacy',
    })
  })

  test('rejects executed evidence packs that still lack canonical result schema', () => {
    const validation = validateDsxuToolEvidencePack({
      schemaVersion: 'dsxu.tool-evidence-pack.v1',
      packId: 'pack-missing-canonical',
      queryTurnId: 'turn-missing-canonical',
      toolUseId: 'toolu-missing-canonical',
      originalToolId: 'Bash',
      resolvedToolId: 'Bash',
      capabilityTags: ['execute'],
      readWriteClass: 'write-local',
      permissionDecision: 'granted',
      permissionReason: 'allowed',
      gateDecision: 'allow',
      executionDecision: 'execute',
      visibleState: 'completed',
      resultStatus: 'success',
      failureClass: 'unknown',
      recoveryHint: 'no recovery needed',
      artifactPaths: [],
      traceId: 'trace-missing-canonical',
      lifecycle: [
        { event: 'tool_preflight_started', at: 1, summary: 'preflight' },
        { event: 'tool_permission_evaluated', at: 2, summary: 'permission' },
        { event: 'tool_execution_completed', at: 3, summary: 'completed' },
        { event: 'tool_postflight_recorded', at: 4, summary: 'postflight' },
      ],
      createdAt: 1,
    })

    expect(validation.valid).toBe(false)
    expect(validation.violations).toContain(
      'executed tool evidence must include canonicalResultSchema',
    )
  })
})
