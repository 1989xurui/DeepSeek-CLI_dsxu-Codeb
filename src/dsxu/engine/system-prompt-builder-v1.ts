export interface SystemPromptBuilderInput {
  defaultSystemPrompt: string[]
  userContext: Record<string, unknown>
  systemContext: Record<string, unknown>
  appendSystemPrompt?: string
  customSystemPrompt?: string
}

export interface SystemPromptLayer {
  layer: 'base' | 'user-context' | 'system-context' | 'append'
  text: string
}

export function buildSystemPrompt(config: SystemPromptBuilderInput): string[] {
  const prompt = renderSystemPromptText(config)
  return prompt.split('\n\n').map((line) => line.trim()).filter(Boolean)
}

export function renderSystemPromptText(config: SystemPromptBuilderInput): string {
  const defaultPrompt = config.customSystemPrompt
    ? config.customSystemPrompt
    : config.defaultSystemPrompt.join('\n')

  const userContextEntries = Object.entries(config.userContext).map(([key, value]) => `${key}=${String(value)}`)
  const systemContextEntries = Object.entries(config.systemContext).map(
    ([key, value]) => `${key}=${String(value)}`,
  )

  const layers: SystemPromptLayer[] = [
    { layer: 'base', text: defaultPrompt },
    { layer: 'user-context', text: userContextEntries.map((line) => `user-context.${line}`).join('\n') || 'user-context:{}' },
    { layer: 'system-context', text: systemContextEntries.map((line) => `system-context.${line}`).join('\n') || 'system-context:{}' },
  ]

  if (config.appendSystemPrompt) {
    layers.push({ layer: 'append', text: config.appendSystemPrompt })
  }

  return layers
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n\n')
}
