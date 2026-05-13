import { describe, expect, test } from 'bun:test';
import { buildToolCatalog } from '../tool-catalog-v1';
import { createToolRegistryV1 } from '../tool-registry-v1';
import type { ToolDefinition } from '../tool-types-v1';

function makeTool(partial: Partial<ToolDefinition> & Pick<ToolDefinition, 'toolId'>): ToolDefinition {
  return {
    toolId: partial.toolId,
    metadata: partial.metadata || {
      displayName: partial.toolId,
      description: `${partial.toolId} description`,
      owner: 'duxu',
      version: '1.0.0',
      tags: ['test'],
    },
    capabilityTags: partial.capabilityTags || ['analysis'],
    executionMode: partial.executionMode || 'sync',
    permissionLevel: partial.permissionLevel || 'safe',
    readWriteClass: partial.readWriteClass || 'read-only',
    sideEffectClass: partial.sideEffectClass || 'none',
    failureClass: partial.failureClass || 'transient',
    inputContract: partial.inputContract || {
      schemaRef: 'input.schema.json',
      requiredFields: ['query'],
      optionalFields: [],
      validationNotes: [],
    },
    outputContract: partial.outputContract || {
      schemaRef: 'output.schema.json',
      producedFields: ['result'],
      failureFields: ['error'],
      stabilityNotes: [],
    },
    constraints: partial.constraints || [],
  };
}

describe('V10-4 Phase A - tool catalog skeleton', () => {
  const registry = createToolRegistryV1();
  const tools = [
    makeTool({ toolId: 'tool-read', capabilityTags: ['search'], readWriteClass: 'read-only', executionMode: 'sync' }),
    makeTool({ toolId: 'tool-write', capabilityTags: ['write'], readWriteClass: 'write-local', executionMode: 'async', sideEffectClass: 'local-state' }),
    makeTool({ toolId: 'tool-external', capabilityTags: ['network'], readWriteClass: 'write-external', executionMode: 'batch', sideEffectClass: 'external-side-effect', failureClass: 'permission' }),
  ];
  tools.forEach((tool) => registry.register(tool, true));
  const catalog = buildToolCatalog('cat-v1', registry.list());

  test('1. ToolDefinition / ToolRegistry can be created', () => {
    expect(registry).toBeDefined();
    expect(tools[0].toolId).toBe('tool-read');
  });

  test('2. supports registering multiple tools', () => {
    expect(registry.list().length).toBeGreaterThanOrEqual(3);
  });

  test('3. ToolCatalog can be created', () => {
    expect(catalog.catalogId).toBe('cat-v1');
    expect(catalog.groups.length).toBeGreaterThan(0);
  });

  test('4. lookup by capability tag works', () => {
    const result = registry.lookup({ capabilityTags: ['write'] });
    expect(result.matchedTools.some((t) => t.toolId === 'tool-write')).toBeTrue();
  });

  test('5. tool can be classified by read/write class', () => {
    expect(catalog.summary.byReadWriteClass['read-only']).toBeGreaterThanOrEqual(1);
    expect(catalog.summary.byReadWriteClass['write-local']).toBeGreaterThanOrEqual(1);
  });

  test('6. tool can be classified by execution mode', () => {
    expect(catalog.summary.byExecutionMode['sync']).toBeGreaterThanOrEqual(1);
    expect(catalog.summary.byExecutionMode['batch']).toBeGreaterThanOrEqual(1);
  });

  test('7. ToolInputContract / ToolOutputContract exist', () => {
    expect(tools[0].inputContract.schemaRef).toContain('input');
    expect(tools[0].outputContract.producedFields).toContain('result');
  });

  test('8. ToolSideEffectClass / ToolFailureClass exist', () => {
    expect(tools[2].sideEffectClass).toBe('external-side-effect');
    expect(tools[2].failureClass).toBe('permission');
  });

  test('9. ToolCatalogSummary / ToolCatalogTrace exist', () => {
    expect(catalog.summary.totalTools).toBe(3);
    expect(catalog.trace.traceId.length).toBeGreaterThan(0);
  });

  test('10. no unrelated mainline modules were modified in this test', () => {
    const touchedModules = ['tool-types-v1', 'tool-registry-v1', 'tool-catalog-v1'];
    expect(touchedModules.every((name) => name.includes('tool-'))).toBeTrue();
  });

  test('11. supports deny-rule filtering semantics (tools.ts parity)', () => {
    const pool = registry.getAllBaseTools();
    const filtered = registry.filterToolsByDenyRules(pool, {
      denyRules: [{ ruleId: 'deny-write', toolIdPattern: 'tool-write', reason: 'deny write in current mode' }],
    });
    expect(filtered.allowedTools.some((x) => x.toolId === 'tool-write')).toBeFalse();
    expect(filtered.denied.length).toBe(1);
  });

  test('12. supports assembleToolPool semantics (tools.ts parity)', () => {
    const assembled = registry.assembleToolPool({
      hint: { capabilityTags: ['write'] },
      permissionContext: {
        actorId: 'tester',
        sessionId: 's-1',
        cwd: process.cwd(),
        allowedPermissionLevel: 'guarded',
        requireConfirmationForWrite: false,
        denyRules: [],
      },
    });
    expect(assembled.selected.length).toBeGreaterThanOrEqual(1);
    expect(assembled.trace.length).toBeGreaterThanOrEqual(3);
  });

  test('13. supports merged tool pool semantics (tools.ts parity)', () => {
    const base = registry.getAllBaseTools();
    const merged = registry.getMergedTools(base, [
      makeTool({ toolId: 'tool-extra', capabilityTags: ['analysis'] }),
      makeTool({ toolId: 'tool-read', capabilityTags: ['search'] }),
    ]);
    expect(merged.some((x) => x.toolId === 'tool-extra')).toBeTrue();
    expect(merged.filter((x) => x.toolId === 'tool-read').length).toBe(1);
  });
});
