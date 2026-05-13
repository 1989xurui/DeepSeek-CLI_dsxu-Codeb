export type BrowserPromptIntegrationInput = {
  basePrompt: string
  toolSearchEnabled: boolean
  skillHint?: string
}

export type BrowserPromptIntegrationResult = {
  basePrompt: string
  includesToolSearchInstructions: boolean
  includesSkillHint: boolean
}

export function browserPromptIntegration(input: BrowserPromptIntegrationInput): BrowserPromptIntegrationResult {
  const toolSearchBlock = input.toolSearchEnabled ? '\n\nchrome-tool-search-required' : ''
  const skillHintBlock = input.skillHint ? `\n\n${input.skillHint}` : ''

  return {
    basePrompt: `${input.basePrompt}${toolSearchBlock}${skillHintBlock}`,
    includesToolSearchInstructions: input.toolSearchEnabled,
    includesSkillHint: Boolean(input.skillHint),
  }
}
