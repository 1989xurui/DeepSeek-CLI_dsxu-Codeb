export type SkillTag = 'code-edit' | 'analysis' | 'test' | 'recovery' | (string & {})

export type SkillTriggerType = 'keyword' | 'tag' | 'runtime-hint' | 'session-hint'

export interface SkillMetadata {
  name: string
  description: string
  version: string
  owner: string
  tags: SkillTag[]
}

export interface SkillInputContract {
  requiredFields: string[]
  optionalFields: string[]
  schemaHint?: string
}

export interface SkillOutputContract {
  outputFields: string[]
  qualitySignals: string[]
  failureSignals: string[]
}

export interface SkillTrigger {
  id: string
  type: SkillTriggerType
  expression: string
  weight: number
}

export interface SkillConstraint {
  id: string
  type: 'single-writer' | 'exclusive' | 'requires-tool' | (string & {})
  description: string
}

export interface SkillGovernancePolicy {
  useWhen: string[]
  doNotUseWhen: string[]
  requiredTools: string[]
  forbiddenTools: string[]
  exitCriteria: string[]
  evidenceFields: string[]
}

export interface SkillDefinition {
  skillId: string
  metadata: SkillMetadata
  input: SkillInputContract
  output: SkillOutputContract
  triggers: SkillTrigger[]
  constraints: SkillConstraint[]
  governance?: SkillGovernancePolicy
}
