export type DSXUPromptProfileId = 'default' | 'explanatory' | 'learning' | 'project_style'

export type DSXUPromptProfileSource = 'dsxu_builtin' | 'project_policy'

export interface DSXUPromptProfile {
  id: DSXUPromptProfileId
  name: string
  source: DSXUPromptProfileSource
  description: string
  prompt: string
  keepCodingInstructions: boolean
  appliesToMainline: boolean
  replacedDSXUSource?: string
}

const INSIGHT_DIRECTIVE = [
  'When useful, explain implementation choices briefly and tie them to this repository.',
  'Keep educational notes subordinate to task completion, evidence, tests, and release safety.',
].join('\n')

export const DSXU_PROMPT_PROFILES: Record<DSXUPromptProfileId, DSXUPromptProfile> = {
  default: {
    id: 'default',
    name: 'DSXU Default',
    source: 'dsxu_builtin',
    description: 'Default DSXU coding profile focused on direct execution, evidence, and concise delivery.',
    prompt: [
      'Operate as DSXU Control Plane.',
      'Route work through DSXU Single API, workflow contracts, tool capability contracts, and release gates.',
      'Do not depend on DSXU CLI output-style loaders or .dsxu shell directories.',
    ].join('\n'),
    keepCodingInstructions: true,
    appliesToMainline: true,
  },
  explanatory: {
    id: 'explanatory',
    name: 'Explanatory',
    source: 'dsxu_builtin',
    description: 'Absorbed output-style semantics: explain key implementation choices without weakening execution.',
    prompt: [
      'Use DSXU evidence-first coding behavior.',
      INSIGHT_DIRECTIVE,
      'Prefer concrete file, test, and runtime evidence over general commentary.',
    ].join('\n'),
    keepCodingInstructions: true,
    appliesToMainline: true,
    replacedDSXUSource: 'constants/outputStyles.ts:Explanatory',
  },
  learning: {
    id: 'learning',
    name: 'Learning',
    source: 'dsxu_builtin',
    description: 'Absorbed learning-mode semantics while preserving DSXU ownership of execution.',
    prompt: [
      'Use collaborative learning only when it does not block safe completion.',
      'Ask for human contribution only on meaningful design choices; routine edits remain DSXU-owned.',
      INSIGHT_DIRECTIVE,
    ].join('\n'),
    keepCodingInstructions: true,
    appliesToMainline: true,
    replacedDSXUSource: 'constants/outputStyles.ts:Learning',
  },
  project_style: {
    id: 'project_style',
    name: 'Project Style',
    source: 'project_policy',
    description: 'Project or organization style policy now belongs to DSXU Prompt Profile, not .dsxu/output-styles.',
    prompt: [
      'Apply project policy from DSXU profile configuration and workflow contracts.',
      'CLI profile selection may present profile choices, but DSXU Control Plane owns the prompt profile semantics.',
    ].join('\n'),
    keepCodingInstructions: true,
    appliesToMainline: true,
    replacedDSXUSource: 'outputStyles/loadOutputStylesDir.ts',
  },
}

export function getDSXUPromptProfile(id: DSXUPromptProfileId = 'default'): DSXUPromptProfile {
  return DSXU_PROMPT_PROFILES[id] ?? DSXU_PROMPT_PROFILES.default
}

export function listDSXUPromptProfiles(): DSXUPromptProfile[] {
  return Object.values(DSXU_PROMPT_PROFILES)
}

export function buildDSXUPromptProfileBlock(id: DSXUPromptProfileId = 'default'): string {
  const profile = getDSXUPromptProfile(id)
  return [
    `# DSXU Prompt Profile: ${profile.name}`,
    profile.prompt,
    `keepCodingInstructions: ${profile.keepCodingInstructions}`,
    `source: ${profile.source}`,
  ].join('\n')
}
