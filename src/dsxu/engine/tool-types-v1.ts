export type ToolCapabilityTag =
  | 'analysis'
  | 'search'
  | 'edit'
  | 'write'
  | 'execute'
  | 'network'
  | 'coordination'
  | 'recovery';

export type ToolExecutionMode = 'sync' | 'async' | 'streaming' | 'batch';
export type ToolPermissionLevel = 'safe' | 'guarded' | 'privileged';
export type ToolReadWriteClass = 'read-only' | 'write-local' | 'write-external';
export type ToolSideEffectClass = 'none' | 'local-state' | 'external-side-effect';
export type ToolFailureClass = 'transient' | 'deterministic' | 'permission' | 'conflict' | 'unknown';

export interface ToolConstraint {
  id: string;
  description: string;
  requiresConfirmation?: boolean;
  blocksParallelWith?: string[];
}

export interface ToolInputContract {
  schemaRef: string;
  requiredFields: string[];
  optionalFields: string[];
  validationNotes: string[];
}

export interface ToolOutputContract {
  schemaRef: string;
  producedFields: string[];
  failureFields: string[];
  stabilityNotes: string[];
}

export interface ToolMetadata {
  displayName: string;
  description: string;
  owner: string;
  version: string;
  tags: string[];
}

export interface ToolInputJSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  items?: any;
  enum?: string[];
  description?: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
  code: 'missing_required' | 'invalid_type' | 'forbidden_property' | 'custom';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ToolDenyRule {
  ruleId: string;
  toolIdPattern: string;
  reason: string;
}

export interface ToolPermissionContext {
  actorId: string;
  sessionId: string;
  cwd: string;
  allowedPermissionLevel: ToolPermissionLevel;
  requireConfirmationForWrite: boolean;
  denyRules: ToolDenyRule[];
}

export interface ToolRuntimeExecutionRequest {
  toolId: string;
  input: Record<string, any>;
  toolUseId: string;
}

export interface ToolRuntimeExecutionResult {
  toolUseId: string;
  content: string;
  isError: boolean;
  meta?: Record<string, any>;
}

export interface ToolDefinition {
  toolId: string;
  metadata: ToolMetadata;
  capabilityTags: ToolCapabilityTag[];
  executionMode: ToolExecutionMode;
  permissionLevel: ToolPermissionLevel;
  readWriteClass: ToolReadWriteClass;
  sideEffectClass: ToolSideEffectClass;
  failureClass: ToolFailureClass;
  inputContract: ToolInputContract;
  outputContract: ToolOutputContract;
  constraints: ToolConstraint[];
  inputSchema?: ToolInputJSONSchema;
  validateInput?: (input: Record<string, any>) => ValidationResult;
  execute?: (request: ToolRuntimeExecutionRequest, context: ToolPermissionContext) => Promise<ToolRuntimeExecutionResult>;
  aliasOf?: string;
}

export function createValidationResult(valid: boolean, issues: ValidationIssue[] = []): ValidationResult {
  return { valid, issues };
}

export function validateRequiredFields(input: Record<string, any>, requiredFields: string[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const field of requiredFields) {
    if (input[field] === undefined) {
      issues.push({
        path: field,
        message: `missing required field: ${field}`,
        code: 'missing_required',
      });
    }
  }
  return createValidationResult(issues.length === 0, issues);
}

export interface ToolSelectionHint {
  capabilityTags?: ToolCapabilityTag[];
  preferredModes?: ToolExecutionMode[];
  requiredPermissionAtLeast?: ToolPermissionLevel;
  readWriteClass?: ToolReadWriteClass;
}

export interface ToolLookupResult {
  matchedTools: ToolDefinition[];
  filteredOut: Array<{ toolId: string; reason: string }>;
  trace: string[];
}

export interface ToolRegistryEntry {
  tool: ToolDefinition;
  enabled: boolean;
  addedAt: number;
}

export interface ToolCatalogGroup {
  groupId: string;
  title: string;
  toolIds: string[];
  basis: 'capability' | 'execution-mode' | 'read-write-class';
}

export interface ToolCatalogSummary {
  totalTools: number;
  byCapability: Record<string, number>;
  byExecutionMode: Record<string, number>;
  byReadWriteClass: Record<string, number>;
  byFailureClass: Record<string, number>;
}

export interface ToolCatalogTrace {
  traceId: string;
  generatedAt: number;
  includedToolIds: string[];
  groupingStrategy: string[];
  notes: string[];
}

export interface ToolCatalog {
  catalogId: string;
  groups: ToolCatalogGroup[];
  summary: ToolCatalogSummary;
  trace: ToolCatalogTrace;
}
