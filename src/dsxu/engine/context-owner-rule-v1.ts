import type {
  DsxuLocalMemoryBundle,
  DsxuTaskStateSnapshotPromptState,
} from './task-governance';

export type DsxuContextOwner =
  | 'user_instruction'
  | 'current_source_files'
  | 'latest_verification_output'
  | 'compact_snapshot'
  | 'memory_hint'
  | 'tool_evidence';

export type DsxuContextOwnerBlockReason =
  | 'source_truth_refresh_required'
  | 'source_truth_not_reread_after_resume'
  | 'verification_not_passed'
  | 'verification_not_rerun_after_resume'
  | 'failed_command_unresolved'
  | 'permission_denial_unresolved'
  | 'memory_cannot_select_edit_target'
  | 'memory_cannot_claim_pass';

export interface DsxuContextOwnerRuleInput {
  goal?: string;
  currentSourceFiles?: readonly string[];
  filesChanged?: readonly string[];
  rereadFiles?: readonly string[];
  sourceTruthRefreshRequired?: boolean;
  sourceTruthRereadAfterResume?: boolean;
  verificationStatus?: 'unknown' | 'unverified' | 'partial' | 'failed' | 'passed';
  verificationEvidenceAfterResume?: boolean;
  failedCommands?: readonly string[];
  permissionDenials?: readonly string[];
  activeAgents?: readonly string[];
  pendingTasks?: readonly string[];
  toolEvidenceTraceIds?: readonly string[];
  memoryEntryIds?: readonly string[];
  createdAt?: string;
}

export interface DsxuContextOwnerRuleDecision {
  schemaVersion: 'dsxu.context-owner-rule.v1';
  sourceTruthOwner: 'current_source_files';
  editTargetOwner: 'current_source_files';
  verificationOwner: 'latest_verification_output';
  memoryOwner: 'memory_hint';
  snapshotOwner: 'compact_snapshot';
  userInstructionOwner: 'user_instruction';
  toolEvidenceOwner: 'tool_evidence';
  memoryMaySelectEditTarget: false;
  memoryMayClaimPass: false;
  mayEdit: boolean;
  mayClaimPass: boolean;
  requiredBeforeEdit: readonly string[];
  requiredBeforePass: readonly string[];
  blockReasons: readonly DsxuContextOwnerBlockReason[];
  trace: readonly string[];
  rendered: string;
}

export interface DsxuContextOwnerRuleValidation {
  valid: boolean;
  missingFields: readonly string[];
  violations: readonly string[];
}

export function buildDsxuContextOwnerRuleDecision(
  input: DsxuContextOwnerRuleInput,
): DsxuContextOwnerRuleDecision {
  const failedCommands = [...(input.failedCommands ?? [])].filter(Boolean);
  const permissionDenials = [...(input.permissionDenials ?? [])].filter(Boolean);
  const rereadFiles = [...new Set([...(input.rereadFiles ?? []), ...(input.filesChanged ?? [])].filter(Boolean))];
  const currentSourceFiles = [...new Set(input.currentSourceFiles ?? [])];
  const sourceTruthRefreshRequired =
    input.sourceTruthRefreshRequired === true || rereadFiles.length > 0;
  const sourceTruthRereadAfterResume = input.sourceTruthRereadAfterResume === true;
  const verificationStatus = input.verificationStatus ?? 'unknown';
  const verificationEvidenceAfterResume = input.verificationEvidenceAfterResume === true;
  const blockReasons: DsxuContextOwnerBlockReason[] = [];
  const requiredBeforeEdit: string[] = [];
  const requiredBeforePass: string[] = [];

  if (sourceTruthRefreshRequired) {
    for (const filePath of rereadFiles) {
      requiredBeforeEdit.push(`Read current source truth for ${filePath}`);
      requiredBeforePass.push(`Read current source truth for ${filePath}`);
    }
  }
  if (sourceTruthRefreshRequired && !sourceTruthRereadAfterResume) {
    blockReasons.push('source_truth_refresh_required');
    blockReasons.push('source_truth_not_reread_after_resume');
  }
  if (verificationStatus !== 'passed') {
    blockReasons.push('verification_not_passed');
    requiredBeforePass.push('Run focused verification and capture output');
  }
  if (verificationStatus === 'passed' && !verificationEvidenceAfterResume) {
    blockReasons.push('verification_not_rerun_after_resume');
    requiredBeforePass.push('Record verification output after resume');
  }
  if (failedCommands.length > 0) {
    blockReasons.push('failed_command_unresolved');
    for (const command of failedCommands) {
      requiredBeforePass.push(`Resolve failed command: ${command}`);
    }
  }
  if (permissionDenials.length > 0) {
    blockReasons.push('permission_denial_unresolved');
    for (const denial of permissionDenials) {
      requiredBeforePass.push(`Resolve permission denial: ${denial}`);
    }
  }

  const mayEdit = !sourceTruthRefreshRequired || sourceTruthRereadAfterResume;
  const mayClaimPass =
    verificationStatus === 'passed' &&
    verificationEvidenceAfterResume &&
    (!sourceTruthRefreshRequired || sourceTruthRereadAfterResume) &&
    failedCommands.length === 0 &&
    permissionDenials.length === 0;

  const uniqueRequiredBeforeEdit = [...new Set(requiredBeforeEdit)];
  const uniqueRequiredBeforePass = [...new Set(requiredBeforePass)];
  const trace = [
    `goal=${input.goal || 'unknown'}`,
    `sourceTruthOwner=current_source_files`,
    `editTargetOwner=current_source_files`,
    `verificationOwner=latest_verification_output`,
    `memoryOwner=memory_hint`,
    `sourceTruthRefreshRequired=${sourceTruthRefreshRequired ? 'yes' : 'no'}`,
    `sourceTruthRereadAfterResume=${sourceTruthRereadAfterResume ? 'yes' : 'no'}`,
    `verificationStatus=${verificationStatus}`,
    `verificationEvidenceAfterResume=${verificationEvidenceAfterResume ? 'yes' : 'no'}`,
    `failedCommands=${failedCommands.length}`,
    `permissionDenials=${permissionDenials.length}`,
    `toolEvidenceTraceIds=${(input.toolEvidenceTraceIds ?? []).length}`,
    `memoryEntryIds=${(input.memoryEntryIds ?? []).length}`,
  ];

  return {
    schemaVersion: 'dsxu.context-owner-rule.v1',
    sourceTruthOwner: 'current_source_files',
    editTargetOwner: 'current_source_files',
    verificationOwner: 'latest_verification_output',
    memoryOwner: 'memory_hint',
    snapshotOwner: 'compact_snapshot',
    userInstructionOwner: 'user_instruction',
    toolEvidenceOwner: 'tool_evidence',
    memoryMaySelectEditTarget: false,
    memoryMayClaimPass: false,
    mayEdit,
    mayClaimPass,
    requiredBeforeEdit: uniqueRequiredBeforeEdit,
    requiredBeforePass: uniqueRequiredBeforePass,
    blockReasons: [...new Set(blockReasons)],
    trace,
    rendered: renderDsxuContextOwnerRuleDecision({
      mayEdit,
      mayClaimPass,
      requiredBeforeEdit: uniqueRequiredBeforeEdit,
      requiredBeforePass: uniqueRequiredBeforePass,
      blockReasons: [...new Set(blockReasons)],
      trace,
    }),
  };
}

export function buildDsxuContextOwnerRuleFromResume(input: {
  snapshot: DsxuTaskStateSnapshotPromptState;
  memory: DsxuLocalMemoryBundle;
  sourceTruthRereadAfterResume?: boolean;
  verificationEvidenceAfterResume?: boolean;
  toolEvidenceTraceIds?: readonly string[];
}): DsxuContextOwnerRuleDecision {
  return buildDsxuContextOwnerRuleDecision({
    goal: input.snapshot.goal,
    currentSourceFiles: [...(input.snapshot.filesRead ?? []), ...(input.snapshot.filesChanged ?? [])],
    filesChanged: input.snapshot.filesChanged,
    rereadFiles: input.memory.rereadFiles,
    sourceTruthRefreshRequired: input.memory.sourceTruthRefreshRequired,
    sourceTruthRereadAfterResume: input.sourceTruthRereadAfterResume,
    verificationStatus: input.snapshot.verificationStatus,
    verificationEvidenceAfterResume: input.verificationEvidenceAfterResume,
    failedCommands: input.snapshot.failedCommands,
    permissionDenials: input.snapshot.permissionDenials,
    activeAgents: input.snapshot.activeAgents,
    pendingTasks: input.snapshot.pendingTasks,
    toolEvidenceTraceIds: input.toolEvidenceTraceIds,
    memoryEntryIds: input.memory.entries.map(entry => entry.id),
    createdAt: input.snapshot.createdAt,
  });
}

export function validateDsxuContextOwnerRuleDecision(
  decision: DsxuContextOwnerRuleDecision,
): DsxuContextOwnerRuleValidation {
  const missingFields: string[] = [];
  const violations: string[] = [];
  const requiredFields: Array<keyof DsxuContextOwnerRuleDecision> = [
    'schemaVersion',
    'sourceTruthOwner',
    'editTargetOwner',
    'verificationOwner',
    'memoryOwner',
    'snapshotOwner',
    'userInstructionOwner',
    'toolEvidenceOwner',
    'requiredBeforeEdit',
    'requiredBeforePass',
    'blockReasons',
    'trace',
    'rendered',
  ];

  for (const field of requiredFields) {
    const value = decision[field];
    if (value === undefined || value === null || value === '') missingFields.push(field);
  }
  if (decision.schemaVersion !== 'dsxu.context-owner-rule.v1') {
    violations.push('schemaVersion must be dsxu.context-owner-rule.v1');
  }
  if (decision.sourceTruthOwner !== 'current_source_files') {
    violations.push('sourceTruthOwner must be current_source_files');
  }
  if (decision.editTargetOwner !== 'current_source_files') {
    violations.push('editTargetOwner must be current_source_files');
  }
  if (decision.verificationOwner !== 'latest_verification_output') {
    violations.push('verificationOwner must be latest_verification_output');
  }
  if (decision.memoryMaySelectEditTarget !== false) {
    violations.push('memoryMaySelectEditTarget must be false');
  }
  if (decision.memoryMayClaimPass !== false) {
    violations.push('memoryMayClaimPass must be false');
  }
  if (decision.mayClaimPass && decision.blockReasons.includes('verification_not_rerun_after_resume')) {
    violations.push('mayClaimPass cannot be true without post-resume verification evidence');
  }

  return {
    valid: missingFields.length === 0 && violations.length === 0,
    missingFields,
    violations,
  };
}

function renderDsxuContextOwnerRuleDecision(input: {
  mayEdit: boolean;
  mayClaimPass: boolean;
  requiredBeforeEdit: readonly string[];
  requiredBeforePass: readonly string[];
  blockReasons: readonly DsxuContextOwnerBlockReason[];
  trace: readonly string[];
}): string {
  return [
    '## Context Owner Rule',
    '- sourceTruthOwner: current_source_files',
    '- editTargetOwner: current_source_files',
    '- verificationOwner: latest_verification_output',
    '- memoryOwner: memory_hint',
    '- memoryMaySelectEditTarget: false',
    '- memoryMayClaimPass: false',
    `- mayEdit: ${input.mayEdit ? 'yes' : 'no'}`,
    `- mayClaimPass: ${input.mayClaimPass ? 'yes' : 'no'}`,
    `- requiredBeforeEdit: ${input.requiredBeforeEdit.length ? input.requiredBeforeEdit.join('; ') : 'none'}`,
    `- requiredBeforePass: ${input.requiredBeforePass.length ? input.requiredBeforePass.join('; ') : 'none'}`,
    `- blockReasons: ${input.blockReasons.length ? input.blockReasons.join(', ') : 'none'}`,
    `- trace: ${input.trace.join('; ')}`,
  ].join('\n');
}
