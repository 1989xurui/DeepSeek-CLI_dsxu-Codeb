import {
  DEEPSEEK_V4_CONTEXT_WINDOW,
  DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
  getDeepSeekV4DefaultMaxTokens,
  isDeepSeekV4ModelLike,
} from '../../utils/model/deepseekV4Control'
import {
  getArchivedContextWindowOverride,
  getArchivedMaxOutputTokensOverride,
} from '../../utils/model/providerMigration/providerMigrationContextWindowManager'

export const MODEL_CONTEXT_WINDOW_DEFAULT = DEEPSEEK_V4_CONTEXT_WINDOW;

export function getContextWindowForModel(model: string): number {
  const m = model.toLowerCase();
  if (isDeepSeekV4ModelLike(m)) return DEEPSEEK_V4_CONTEXT_WINDOW;
  const compatWindow = getArchivedContextWindowOverride(m)
  if (compatWindow) return compatWindow;
  return MODEL_CONTEXT_WINDOW_DEFAULT;
}

export function getModelMaxOutputTokens(model: string): { default: number; upperLimit: number } {
  const m = model.toLowerCase();
  if (isDeepSeekV4ModelLike(m)) {
    return {
      default: getDeepSeekV4DefaultMaxTokens({ model, apiMode: 'thinking', reasoningEffort: 'max' }),
      upperLimit: DEEPSEEK_V4_MAX_CHAT_OUTPUT_TOKENS,
    };
  }
  const compatTokens = getArchivedMaxOutputTokensOverride(m)
  if (compatTokens) return compatTokens;
  return { default: 32_000, upperLimit: 64_000 };
}

export function calculateContextPercentages(
  currentUsage: { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number } | null,
  contextWindowSize: number,
): { used: number | null; remaining: number | null } {
  if (!currentUsage) return { used: null, remaining: null };
  const total =
    currentUsage.input_tokens +
    currentUsage.cache_creation_input_tokens +
    currentUsage.cache_read_input_tokens;
  const used = Math.min(100, Math.max(0, Math.round((total / contextWindowSize) * 100)));
  return { used, remaining: 100 - used };
}

export function shouldTriggerAutoCompact(input: {
  usedPercent: number;
  autoCompactEnabled: boolean;
  threshold?: number;
}): boolean {
  const threshold = input.threshold ?? 80;
  return input.autoCompactEnabled && input.usedPercent >= threshold;
}

export function getCompactionStrategy(input: {
  usedPercent: number;
  duplicateReadPercent?: number;
}): {
  strategy: 'none' | 'light' | 'aggressive';
  reason: string;
} {
  if (input.usedPercent < 60) return { strategy: 'none', reason: 'usage healthy' };
  if (input.usedPercent > 85 || (input.duplicateReadPercent || 0) > 10) {
    return { strategy: 'aggressive', reason: 'high context pressure or duplicate-read bloat' };
  }
  return { strategy: 'light', reason: 'moderate context pressure' };
}

export function analyzeContext(input: {
  messages: Array<{ role: string; content: string }>;
  contextWindowSize: number;
  memoryTokens?: number;
  duplicateReadTokens?: number;
}): {
  usedTokens: number;
  usedPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
} {
  const messageTokens = Math.floor(input.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4);
  const usedTokens = messageTokens + (input.memoryTokens || 0) + (input.duplicateReadTokens || 0);
  const usedPercent = Math.min(100, Math.round((usedTokens / Math.max(1, input.contextWindowSize)) * 100));
  const riskLevel = usedPercent >= 85 ? 'high' : usedPercent >= 60 ? 'medium' : 'low';
  return { usedTokens, usedPercent, riskLevel };
}

export function contextSuggestions(input: {
  usedPercent: number;
  duplicateReadTokens?: number;
}): Array<{ severity: 'info' | 'warning'; message: string }> {
  const out: Array<{ severity: 'info' | 'warning'; message: string }> = [];
  if (input.usedPercent >= 80) {
    out.push({ severity: 'warning', message: 'context nearing window limit; consider compaction' });
  }
  if ((input.duplicateReadTokens || 0) > 1000) {
    out.push({ severity: 'info', message: 'duplicate reads detected; cache/reuse read ranges' });
  }
  if (out.length === 0) out.push({ severity: 'info', message: 'context health is stable' });
  return out;
}

export function doctorContextWarnings(input: {
  usedPercent: number;
  shellOutputTokens?: number;
}): Array<{ code: string; level: 'low' | 'medium' | 'high'; message: string }> {
  const warnings: Array<{ code: string; level: 'low' | 'medium' | 'high'; message: string }> = [];
  if (input.usedPercent > 90) warnings.push({ code: 'context-overflow-risk', level: 'high', message: 'context almost full' });
  if ((input.shellOutputTokens || 0) > 3000) warnings.push({ code: 'shell-output-bloat', level: 'medium', message: 'shell output bloat detected' });
  return warnings;
}

export function queryGuard(input: {
  estimatedTokens: number;
  contextWindowSize: number;
  allowAutoCompact?: boolean;
}): {
  allow: boolean;
  decision: 'allow' | 'warn' | 'block' | 'compact-first';
  reason: string;
} {
  const usedPercent = Math.round((input.estimatedTokens / Math.max(1, input.contextWindowSize)) * 100);
  if (usedPercent >= 98) return { allow: false, decision: 'block', reason: 'query would exceed context window' };
  if (usedPercent >= 88 && input.allowAutoCompact !== false) {
    return { allow: true, decision: 'compact-first', reason: 'high context pressure; compact before query' };
  }
  if (usedPercent >= 75) return { allow: true, decision: 'warn', reason: 'query near window limit' };
  return { allow: true, decision: 'allow', reason: 'query within safe budget' };
}

export function contextWindowUpgradeCheck(input: {
  model: string;
  estimatedTokens: number;
}): {
  shouldUpgrade: boolean;
  targetWindow: number;
  reason: string;
} {
  const current = getContextWindowForModel(input.model);
  const shouldUpgrade = input.estimatedTokens > current * 0.85;
  return {
    shouldUpgrade,
    targetWindow: shouldUpgrade ? current * 2 : current,
    reason: shouldUpgrade ? 'estimated usage exceeds 85% of current model window' : 'current window is sufficient',
  };
}
