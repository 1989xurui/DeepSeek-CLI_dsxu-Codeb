import type { PermissionMode } from '../permissions/PermissionMode.js'
import {
  DSXU_AGENT_MODEL_ALIASES,
  type DsxuAgentModelAlias,
  type ModelAlias,
} from './aliases.js'
import { getDsxuCodeEnv } from '../envUtils.js'
import { isDSXUCodeMode, parseDSXUModelAlias, renderDSXUModelName } from './dsxuModel.js'
import {
  getAgentModel as getLegacyProviderAgentModel,
  getAgentModelDisplay as getLegacyProviderAgentModelDisplay,
  getAgentModelOptions as getLegacyProviderAgentModelOptions,
  type AgentModelAlias as LegacyAgentModelAlias,
} from '../../dsxu/legacy/model/legacyProviderAgentModel.js'

export const AGENT_MODEL_OPTIONS = DSXU_AGENT_MODEL_ALIASES
export type AgentModelAlias = DsxuAgentModelAlias | LegacyAgentModelAlias

export type AgentModelOption = {
  value: AgentModelAlias
  label: string
  description: string
}

export function getDefaultSubagentModel(): string {
  return 'inherit'
}

export function getAgentModel(
  agentModel: string | undefined,
  parentModel: string,
  toolSpecifiedModel?: ModelAlias,
  permissionMode?: PermissionMode,
): string {
  if (!isDSXUCodeMode()) {
    return getLegacyProviderAgentModel(
      agentModel,
      parentModel,
      toolSpecifiedModel,
      permissionMode,
    )
  }

  const envSubagentModel = getDsxuCodeEnv('SUBAGENT_MODEL')
  if (envSubagentModel) {
    return parseDSXUModelAlias(envSubagentModel)
  }

  if (toolSpecifiedModel) {
    return parseDSXUModelAlias(toolSpecifiedModel)
  }

  const requestedModel = agentModel ?? getDefaultSubagentModel()
  if (requestedModel === 'inherit') {
    return parentModel
  }
  return parseDSXUModelAlias(requestedModel)
}

export function getAgentModelDisplay(model: string | undefined): string {
  if (!isDSXUCodeMode()) {
    return getLegacyProviderAgentModelDisplay(model)
  }
  if (!model) return 'Inherit from parent (default)'
  if (model === 'inherit') return 'Inherit from parent'
  return renderDSXUModelName(model) ?? model
}

export function getAgentModelOptions(): AgentModelOption[] {
  if (!isDSXUCodeMode()) {
    return getLegacyProviderAgentModelOptions()
  }
  return [
    {
      value: 'inherit',
      label: 'Inherit from parent',
      description: 'Use the same DSXU/DeepSeek route as the main conversation',
    },
    {
      value: 'flash',
      label: 'DeepSeek V4 Flash',
      description: 'Default low-cost model for normal agent work',
    },
    {
      value: 'flash-max',
      label: 'DeepSeek V4 Flash-MAX',
      description: 'Use maximum Flash reasoning budget before Pro escalation',
    },
    {
      value: 'pro',
      label: 'DeepSeek V4 Pro',
      description: 'Use only when the agent needs explicit Pro-level reasoning',
    },
  ] satisfies AgentModelOption[]
}

export function getDsxuAgentModelAliases(): readonly string[] {
  return DSXU_AGENT_MODEL_ALIASES
}
