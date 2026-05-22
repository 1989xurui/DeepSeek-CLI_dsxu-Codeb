export type ProfileType = 'plan' | 'edit' | 'review' | 'session'

import { DEEPSEEK_V4_CONTEXT_WINDOW } from '../../../utils/model/deepseekV4Control'

export type ToolCategory = 'read' | 'write' | 'analysis' | 'git' | 'skill' | 'mcp' | 'test'
export type OutputFormat = 'json' | 'patch' | 'text' | 'mixed'

export interface ProfileConfig {
  type: ProfileType
  displayName: string
  description: string
  recommendedModel: string
  temperature: number
  maxOutputTokens: number
  enableReasoning: boolean
  allowedToolCategories: ToolCategory[]
  outputFormat: OutputFormat
  contextLengthLimit?: number
  readOnly: boolean
  thinkingDepth: number
  latencyTolerance: number
}

export const PLAN_PROFILE: ProfileConfig = {
  type: 'plan',
  displayName: '规划者',
  description: 'High-effort read-only analysis and structured planning.',
  recommendedModel: 'deepseek-v4-pro',
  temperature: 0.3,
  maxOutputTokens: 16_384,
  enableReasoning: true,
  allowedToolCategories: ['read', 'analysis', 'git'],
  outputFormat: 'json',
  readOnly: true,
  thinkingDepth: 8,
  latencyTolerance: 8,
}

export const EDIT_PROFILE: ProfileConfig = {
  type: 'edit',
  displayName: '编码者',
  description: 'Low-latency code editing and patch generation.',
  recommendedModel: 'deepseek-v4-flash',
  temperature: 0.2,
  maxOutputTokens: 16_384,
  enableReasoning: false,
  allowedToolCategories: ['read', 'write', 'analysis'],
  outputFormat: 'patch',
  contextLengthLimit: DEEPSEEK_V4_CONTEXT_WINDOW,
  readOnly: false,
  thinkingDepth: 4,
  latencyTolerance: 3,
}

export const REVIEW_PROFILE: ProfileConfig = {
  type: 'review',
  displayName: '审查者',
  description: 'Independent risk review, read-only verification, and regression detection.',
  recommendedModel: 'deepseek-v4-pro',
  temperature: 0.1,
  maxOutputTokens: 16_384,
  enableReasoning: true,
  allowedToolCategories: ['read', 'analysis'],
  outputFormat: 'json',
  readOnly: true,
  thinkingDepth: 7,
  latencyTolerance: 6,
}

export const SESSION_PROFILE: ProfileConfig = {
  type: 'session',
  displayName: '会话操作者',
  description: 'Long-running task handoff, checkpointing, resume, and progress ledger maintenance.',
  recommendedModel: 'deepseek-v4-pro',
  temperature: 0.4,
  maxOutputTokens: 32_768,
  enableReasoning: true,
  allowedToolCategories: ['read', 'write', 'analysis', 'git', 'skill', 'test'],
  outputFormat: 'mixed',
  readOnly: false,
  thinkingDepth: 6,
  latencyTolerance: 7,
}

export const PROFILE_CONFIGS: Record<ProfileType, ProfileConfig> = {
  plan: PLAN_PROFILE,
  edit: EDIT_PROFILE,
  review: REVIEW_PROFILE,
  session: SESSION_PROFILE,
}

export function getProfileConfig(profile: ProfileType): ProfileConfig {
  return PROFILE_CONFIGS[profile] || SESSION_PROFILE
}

export function recommendProfileForTask(taskDescription: string): ProfileType {
  const lowerDesc = taskDescription.toLowerCase()

  if (/(plan|design|architecture|strategy|方案|规划|设计)/.test(lowerDesc)) return 'plan'
  if (/(edit|modify|change|fix|refactor|编写|修改|修复|重构)/.test(lowerDesc)) return 'edit'
  if (/(review|check|audit|verify|validate|审查|检查|验证)/.test(lowerDesc)) return 'review'
  if (/(session|long|multi-step|resume|continue|会话|长任务|多步骤)/.test(lowerDesc)) return 'session'

  const wordCount = taskDescription.split(/\s+/).length
  if (wordCount > 50) return 'session'
  if (wordCount > 20) return 'plan'
  return 'edit'
}

export function isToolAllowedInProfile(toolName: string, profile: ProfileType): boolean {
  const config = getProfileConfig(profile)
  const normalizedToolName = toolName.toLowerCase()

  if (config.readOnly) {
    const writeTools = ['write', 'edit', 'bash', 'git']
    if (writeTools.some((tool) => normalizedToolName.includes(tool))) return false
  }

  return config.allowedToolCategories.includes(inferToolCategory(toolName))
}

function inferToolCategory(toolName: string): ToolCategory {
  const normalized = toolName.toLowerCase()
  if (normalized.includes('read') || normalized.includes('grep') || normalized.includes('glob')) return 'read'
  if (normalized.includes('write') || normalized.includes('edit') || normalized.includes('bash')) return 'write'
  if (normalized.includes('lsp') || normalized.includes('analysis')) return 'analysis'
  if (normalized.includes('git')) return 'git'
  if (normalized.startsWith('skill__')) return 'skill'
  if (normalized.startsWith('mcp__')) return 'mcp'
  if (normalized.includes('test')) return 'test'
  return 'read'
}

export function getAvailableProfiles(): ProfileType[] {
  return Object.keys(PROFILE_CONFIGS) as ProfileType[]
}

export function validateProfileConfig(config: ProfileConfig): string[] {
  const errors: string[] = []
  if (!config.type) errors.push('Profile type is required')
  if (!config.displayName) errors.push('Display name is required')
  if (!config.recommendedModel) errors.push('Recommended model is required')
  if (config.temperature < 0 || config.temperature > 2) errors.push('Temperature must be between 0 and 2')
  if (config.maxOutputTokens <= 0) errors.push('Max output tokens must be positive')
  if (config.thinkingDepth < 1 || config.thinkingDepth > 10) errors.push('Thinking depth must be between 1 and 10')
  if (config.latencyTolerance < 1 || config.latencyTolerance > 10) errors.push('Latency tolerance must be between 1 and 10')
  return errors
}

export {
  DSXU_PROMPT_PROFILES,
  buildDSXUPromptProfileBlock,
  getDSXUPromptProfile,
  listDSXUPromptProfiles,
  type DSXUPromptProfile,
  type DSXUPromptProfileId,
  type DSXUPromptProfileSource,
} from '../prompt-profile'
