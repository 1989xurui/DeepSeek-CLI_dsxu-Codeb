import {
  ToolCapabilityTag,
  ToolDefinition,
  ToolExecutionMode,
  ToolLookupResult,
  ToolPermissionContext,
  ToolPermissionLevel,
  ToolRegistryEntry,
  ToolSelectionHint,
  ValidationResult,
} from './tool-types-v1';
import type { ToolDefinition as RuntimeToolDefinition, ToolContext } from './types';

export class ToolRegistryV1 {
  private entries = new Map<string, ToolRegistryEntry>();

  register(tool: ToolDefinition, enabled = true): ToolRegistryEntry {
    const entry: ToolRegistryEntry = {
      tool,
      enabled,
      addedAt: Date.now(),
    };
    this.entries.set(tool.toolId, entry);
    return entry;
  }

  registerRuntimeTools(runtimeTools: RuntimeToolDefinition[], owner = 'dsxu-mainline', version = '1.0.0'): ToolRegistryEntry[] {
    const entries: ToolRegistryEntry[] = [];
    for (const runtimeTool of runtimeTools) {
      entries.push(this.register(convertRuntimeToolToV1(runtimeTool, owner, version), true));
    }
    return entries;
  }

  list(): ToolRegistryEntry[] {
    return [...this.entries.values()];
  }

  getByToolId(toolId: string): ToolDefinition | undefined {
    return this.entries.get(toolId)?.tool;
  }

  getAllBaseTools(): ToolDefinition[] {
    return this.list()
      .filter((entry) => entry.enabled)
      .map((entry) => entry.tool);
  }

  filterToolsByDenyRules(
    tools: ToolDefinition[],
    permissionContext: Pick<ToolPermissionContext, 'denyRules'>,
  ): { allowedTools: ToolDefinition[]; denied: Array<{ toolId: string; reason: string; ruleId: string }> } {
    const denied: Array<{ toolId: string; reason: string; ruleId: string }> = [];
    const allowedTools: ToolDefinition[] = [];

    for (const tool of tools) {
      const rule = permissionContext.denyRules.find((r) => wildcardMatch(tool.toolId, r.toolIdPattern));
      if (rule) {
        denied.push({ toolId: tool.toolId, reason: rule.reason, ruleId: rule.ruleId });
      } else {
        allowedTools.push(tool);
      }
    }

    return { allowedTools, denied };
  }

  assembleToolPool(input: {
    hint?: ToolSelectionHint;
    permissionContext: ToolPermissionContext;
  }): {
    selected: ToolDefinition[];
    denied: Array<{ toolId: string; reason: string; ruleId: string }>;
    filteredOut: Array<{ toolId: string; reason: string }>;
    trace: string[];
  } {
    const lookup = this.lookup(input.hint || {});
    const { allowedTools, denied } = this.filterToolsByDenyRules(lookup.matchedTools, input.permissionContext);
    return {
      selected: allowedTools,
      denied,
      filteredOut: lookup.filteredOut,
      trace: [...lookup.trace, `denied=${denied.length}`, `selected=${allowedTools.length}`],
    };
  }

  getMergedTools(baseTools: ToolDefinition[], dynamicTools: ToolDefinition[]): ToolDefinition[] {
    const byId = new Map<string, ToolDefinition>();
    for (const tool of [...baseTools, ...dynamicTools]) {
      byId.set(tool.toolId, tool);
    }
    return [...byId.values()];
  }

  lookup(hint: ToolSelectionHint): ToolLookupResult {
    const matchedTools: ToolDefinition[] = [];
    const filteredOut: Array<{ toolId: string; reason: string }> = [];
    const trace: string[] = [];

    for (const entry of this.entries.values()) {
      if (!entry.enabled) {
        filteredOut.push({ toolId: entry.tool.toolId, reason: 'disabled' });
        continue;
      }

      const reasons: string[] = [];
      if (!this.matchesCapability(entry.tool, hint.capabilityTags)) reasons.push('capability-mismatch');
      if (!this.matchesMode(entry.tool, hint.preferredModes)) reasons.push('execution-mode-mismatch');
      if (!this.matchesPermission(entry.tool, hint.requiredPermissionAtLeast)) reasons.push('permission-below-required');
      if (hint.readWriteClass && entry.tool.readWriteClass !== hint.readWriteClass) reasons.push('read-write-class-mismatch');

      if (reasons.length > 0) {
        filteredOut.push({ toolId: entry.tool.toolId, reason: reasons.join(',') });
      } else {
        matchedTools.push(entry.tool);
      }
    }

    trace.push(`registered=${this.entries.size}`);
    trace.push(`matched=${matchedTools.length}`);
    trace.push(`filtered=${filteredOut.length}`);

    return { matchedTools, filteredOut, trace };
  }

  private matchesCapability(tool: ToolDefinition, tags?: ToolCapabilityTag[]): boolean {
    if (!tags || tags.length === 0) return true;
    return tags.some((tag) => tool.capabilityTags.includes(tag));
  }

  private matchesMode(tool: ToolDefinition, modes?: ToolExecutionMode[]): boolean {
    if (!modes || modes.length === 0) return true;
    return modes.includes(tool.executionMode);
  }

  private matchesPermission(tool: ToolDefinition, minPermission?: ToolPermissionLevel): boolean {
    if (!minPermission) return true;
    const rank: Record<ToolPermissionLevel, number> = { safe: 1, guarded: 2, privileged: 3 };
    return rank[tool.permissionLevel] >= rank[minPermission];
  }
}

export function createToolRegistryV1(): ToolRegistryV1 {
  return new ToolRegistryV1();
}

export function validateInputByContract(tool: ToolDefinition, input: Record<string, any>): ValidationResult {
  const issues = [];
  const required = tool.inputContract.requiredFields || [];
  for (const field of required) {
    if (input[field] === undefined) {
      issues.push({ path: field, message: `missing required field: ${field}`, code: 'missing_required' as const });
    }
  }
  return { valid: issues.length === 0, issues };
}

export function convertRuntimeToolToV1(runtimeTool: RuntimeToolDefinition, owner = 'dsxu-mainline', version = '1.0.0'): ToolDefinition {
  const normalizedId = runtimeTool.name.trim();
  const description = runtimeTool.description || normalizedId;
  const required = Array.isArray(runtimeTool.inputSchema?.required) ? runtimeTool.inputSchema.required : [];
  const properties = runtimeTool.inputSchema?.properties || {};
  const propertyKeys = Object.keys(properties);

  const readOnly = runtimeTool.readOnly === true;
  const capTags: ToolCapabilityTag[] = inferCapabilityTags(normalizedId, readOnly);

  return {
    toolId: normalizedId,
    metadata: {
      displayName: normalizedId,
      description,
      owner,
      version,
      tags: ['mainline', 'runtime-tool'],
    },
    capabilityTags: capTags,
    executionMode: 'async',
    permissionLevel: readOnly ? 'safe' : 'guarded',
    readWriteClass: readOnly ? 'read-only' : 'write-local',
    sideEffectClass: readOnly ? 'none' : 'local-state',
    failureClass: 'unknown',
    inputContract: {
      schemaRef: `${normalizedId}.input.schema`,
      requiredFields: required,
      optionalFields: propertyKeys.filter((k) => !required.includes(k)),
      validationNotes: ['converted from runtime tool schema'],
    },
    outputContract: {
      schemaRef: `${normalizedId}.output.schema`,
      producedFields: ['content'],
      failureFields: ['isError'],
      stabilityNotes: ['runtime tool output normalized by DSXU tool-registry'],
    },
    constraints: [],
    inputSchema: runtimeTool.inputSchema,
    validateInput: (input) => validateInputByContract({
      toolId: normalizedId,
      metadata: { displayName: normalizedId, description, owner, version, tags: [] },
      capabilityTags: capTags,
      executionMode: 'async',
      permissionLevel: readOnly ? 'safe' : 'guarded',
      readWriteClass: readOnly ? 'read-only' : 'write-local',
      sideEffectClass: readOnly ? 'none' : 'local-state',
      failureClass: 'unknown',
      inputContract: {
        schemaRef: `${normalizedId}.input.schema`,
        requiredFields: required,
        optionalFields: propertyKeys.filter((k) => !required.includes(k)),
        validationNotes: [],
      },
      outputContract: {
        schemaRef: `${normalizedId}.output.schema`,
        producedFields: ['content'],
        failureFields: ['isError'],
        stabilityNotes: [],
      },
      constraints: [],
    }, input),
    execute: async (request, permissionContext) => {
      const toolContext: ToolContext = {
        cwd: permissionContext.cwd,
        sessionId: permissionContext.sessionId,
        gear: 1,
        toolUseId: request.toolUseId,
      };
      const output = await runtimeTool.execute(request.input, toolContext);
      return {
        toolUseId: request.toolUseId,
        content: output.content,
        isError: output.isError ?? false,
        meta: output.meta,
      };
    },
  };
}

function inferCapabilityTags(toolId: string, readOnly: boolean): ToolCapabilityTag[] {
  const id = toolId.toLowerCase();
  if (id.includes('grep') || id.includes('glob') || id.includes('read') || id.includes('search')) return ['search'];
  if (id.includes('edit')) return ['edit'];
  if (id.includes('write')) return ['write'];
  if (id.includes('bash') || id.includes('exec')) return ['execute'];
  if (id.includes('agent') || id.includes('fork')) return ['coordination'];
  return [readOnly ? 'analysis' : 'execute'];
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}
