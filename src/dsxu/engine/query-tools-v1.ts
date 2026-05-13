export function setupApiQueryHooks(input: { enableProfiler: boolean; enablePromptHook: boolean }) {
  const enabledHooks = [
    input.enableProfiler ? 'api-query-hook-profiler' : undefined,
    input.enablePromptHook ? 'api-query-hook-helper' : undefined,
  ].filter((hook): hook is string => Boolean(hook))

  return { enabledHooks }
}

export function executePromptHooks(prompt: string, enabledHooks: string[]) {
  return {
    transformedPrompt: `${prompt}\n\n[hook:exec] ${enabledHooks.join(', ')}`,
    appliedHooks: enabledHooks,
  }
}

export function executeSideQuery(query: string, input: { enabled: boolean }) {
  return {
    status: input.enabled ? 'executed' : 'skipped',
    outputSummary: input.enabled ? `side-query executed: ${query}` : 'side-query skipped',
  }
}

export function checkUpgradeNeeded(input: { estimatedTokens: number; currentWindow: number; model: string }) {
  const needsUpgrade = input.estimatedTokens > input.currentWindow * 0.8
  return {
    needed: needsUpgrade,
    reason: needsUpgrade
      ? `Estimated ${input.estimatedTokens} tokens approaches ${input.currentWindow} window for ${input.model}`
      : `Current window can handle ${input.model}`,
  }
}

export function helpQuery(topic: string) {
  return {
    topic,
    guidance: `DSXU query help for ${topic}`,
  }
}

export function profileQuery(prompt: string) {
  return {
    prompt,
    estimatedComplexity: prompt.length > 40 ? 'medium' : 'low',
    recommendedMode: prompt.includes('context') ? 'context-profile' : 'standard',
  }
}
