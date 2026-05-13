import type { DsxuExperienceInjection } from './experience-store'

export function fetchSystemPromptParts(input: {
  defaultSystemPrompt: string[];
  userContext: Record<string, string>;
  systemContext: Record<string, string>;
  customSystemPrompt?: string;
}): {
  defaultSystemPrompt: string[];
  userContext: Record<string, string>;
  systemContext: Record<string, string>;
} {
  if (input.customSystemPrompt !== undefined) {
    return { defaultSystemPrompt: [], userContext: input.userContext, systemContext: {} };
  }
  return {
    defaultSystemPrompt: input.defaultSystemPrompt,
    userContext: input.userContext,
    systemContext: input.systemContext,
  };
}

export function buildSideQuestionFallbackParams(input: {
  defaultSystemPrompt: string[];
  appendSystemPrompt?: string;
  customSystemPrompt?: string;
  userContext: Record<string, string>;
  systemContext: Record<string, string>;
  forkContextMessages: Array<{ role: string; content: string }>;
}): {
  systemPrompt: readonly string[];
  userContext: Record<string, string>;
  systemContext: Record<string, string>;
  forkContextMessages: Array<{ role: string; content: string }>;
} {
  const systemPrompt = [
    ...(input.customSystemPrompt !== undefined ? [input.customSystemPrompt] : input.defaultSystemPrompt),
    ...(input.appendSystemPrompt ? [input.appendSystemPrompt] : []),
  ];
  return {
    systemPrompt,
    userContext: input.userContext,
    systemContext: input.customSystemPrompt !== undefined ? {} : input.systemContext,
    forkContextMessages: input.forkContextMessages,
  };
}

export function analyzeContext(input: {
  messages: Array<{ role: string; content: string }>;
  rawMaxTokens: number;
  memoryTokens?: number;
  toolResultTokens?: number;
  duplicateReadTokens?: number;
}): {
  percentage: number;
  totalTokens: number;
  categories: Array<{ name: string; tokens: number }>;
} {
  const totalTokens = Math.floor(input.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const memory = input.memoryTokens || 0;
  const tools = input.toolResultTokens || 0;
  const used = totalTokens + memory + tools;
  const percentage = Math.min(100, Math.round((used / input.rawMaxTokens) * 100));
  return {
    percentage,
    totalTokens: used,
    categories: [
      { name: 'messages', tokens: totalTokens },
      { name: 'memory', tokens: memory },
      { name: 'tool-results', tokens: tools },
      { name: 'duplicate-reads', tokens: input.duplicateReadTokens || 0 },
    ],
  };
}

export function generateContextSuggestions(input: {
  percentage: number;
  duplicateReadTokens?: number;
  autoCompactEnabled: boolean;
}): Array<{ severity: 'info' | 'warning'; title: string; detail: string }> {
  const out: Array<{ severity: 'info' | 'warning'; title: string; detail: string }> = [];
  if (input.percentage >= 80) {
    out.push({
      severity: 'warning',
      title: `Context is ${input.percentage}% full`,
      detail: input.autoCompactEnabled
        ? 'Autocompact will trigger soon, run compact to preserve key state.'
        : 'Autocompact disabled; compact manually to avoid context overflow.',
    });
  }
  if ((input.duplicateReadTokens || 0) > 2000) {
    out.push({
      severity: 'info',
      title: 'Duplicate read bloat detected',
      detail: 'Reuse prior read results or narrow read ranges.',
    });
  }
  if (out.length === 0) {
    out.push({ severity: 'info', title: 'Context healthy', detail: 'No immediate compaction action needed.' });
  }
  return out;
}

export function queryHelpers(input: {
  query: string;
  source: 'main' | 'side' | 'teammate';
  tags?: string[];
}): {
  normalizedQuery: string;
  querySource: string;
  helperTags: string[];
} {
  return {
    normalizedQuery: input.query.trim().replace(/\s+/g, ' '),
    querySource: input.source,
    helperTags: input.tags || [],
  };
}

export function queryProfiler(input: {
  query: string;
  estimatedContextTokens: number;
}): {
  complexity: 'low' | 'medium' | 'high';
  estimatedLatencyMs: number;
  budgetHint: string;
} {
  const q = input.query.length;
  const score = q + input.estimatedContextTokens;
  const complexity = score > 12000 ? 'high' : score > 4000 ? 'medium' : 'low';
  const estimatedLatencyMs = complexity === 'high' ? 1800 : complexity === 'medium' ? 900 : 300;
  return {
    complexity,
    estimatedLatencyMs,
    budgetHint: complexity === 'high' ? 'consider side-query and compact-first' : 'direct query is acceptable',
  };
}

export async function sideQuery(input: {
  question: string;
  context: Array<{ role: string; content: string }>;
}, executor: (payload: { question: string; context: Array<{ role: string; content: string }> }) => Promise<{ answer: string }>): Promise<{
  answer: string;
  source: 'side-query';
}> {
  const result = await executor({ question: input.question, context: input.context });
  return { answer: result.answer, source: 'side-query' };
}

export function readEditContext(input: {
  files: string[];
  intent: 'read' | 'edit' | 'review';
}): {
  intent: 'read' | 'edit' | 'review';
  fileCount: number;
  files: string[];
} {
  return {
    intent: input.intent,
    fileCount: input.files.length,
    files: [...new Set(input.files)],
  };
}

export function apiQueryHookHelper(input: {
  before?: string[];
  after?: string[];
}): {
  enabledHooks: string[];
  count: number;
} {
  const enabledHooks = [...(input.before || []), ...(input.after || [])];
  return { enabledHooks, count: enabledHooks.length };
}

export function execAgentHook(input: {
  agentId: string;
  hookName: string;
  payload?: Record<string, unknown>;
}): {
  accepted: boolean;
  hookTrace: string;
} {
  return {
    accepted: input.agentId.length > 3 && input.hookName.length > 0,
    hookTrace: `${input.agentId}:${input.hookName}:${Object.keys(input.payload || {}).length}`,
  };
}

export function queryGuard(input: {
  estimatedTokens: number;
  contextWindowSize: number;
}): {
  allow: boolean;
  severity: 'low' | 'medium' | 'high';
  reason: string;
} {
  const percent = Math.round((input.estimatedTokens / Math.max(1, input.contextWindowSize)) * 100);
  if (percent >= 98) return { allow: false, severity: 'high', reason: 'token budget would overflow' };
  if (percent >= 85) return { allow: true, severity: 'medium', reason: 'high usage; compact suggested' };
  return { allow: true, severity: 'low', reason: 'safe budget' };
}

export type IntentCategory =
  | 'code-edit'
  | 'code-read'
  | 'debug'
  | 'test'
  | 'refactor'
  | 'security'
  | 'data'
  | 'ops'
  | 'docs'
  | 'planning'
  | 'review'
  | 'unknown';

const INTENT_FEATURE_MATRIX: Record<IntentCategory, string[]> = {
  'code-edit': ['edit', 'modify', 'update', 'change', 'patch', 'rewrite', 'implement', 'fix'],
  'code-read': ['read', 'inspect', 'analyze', 'understand', 'trace', 'lookup', 'find'],
  debug: ['debug', 'error', 'stacktrace', 'exception', 'crash', 'timeout', 'bug'],
  test: ['test', 'unit test', 'integration', 'e2e', 'coverage', 'assert'],
  refactor: ['refactor', 'cleanup', 'simplify', 'extract', 'rename', 'deduplicate'],
  security: ['security', 'vulnerability', 'sanitize', 'escape', 'permission', 'auth', 'injection'],
  data: ['sql', 'query', 'dataset', 'csv', 'json', 'parse', 'transform'],
  ops: ['deploy', 'pipeline', 'ci', 'workflow', 'build', 'release', 'monitor'],
  docs: ['docs', 'document', 'readme', 'comment', 'explain', 'guide'],
  planning: ['plan', 'roadmap', 'milestone', 'timeline', 'phase', 'scope'],
  review: ['review', 'audit', 'risk', 'regression', 'validate', 'verify'],
  unknown: [],
};

const DANGEROUS_COMMANDS = [
  'rm',
  'rmdir',
  'del',
  'erase',
  'format',
  'mkfs',
  'dd',
  'chmod',
  'chown',
  'curl',
  'wget',
  'powershell',
  'bash',
  'sh',
];
const DANGEROUS_FLAGS = ['-rf', '-fr', '/s', '/q', '--no-preserve-root', '-R', '-p', '-c'];
const DANGEROUS_TARGETS = ['/', '/*', '~', '$HOME', '/etc', '/var', 'C:\\', 'D:\\', '*'];

const HIGH_RISK_BASH_REGEXES: RegExp[] = (() => {
  const patterns: RegExp[] = [];
  for (const cmd of DANGEROUS_COMMANDS) {
    for (const flag of DANGEROUS_FLAGS) {
      for (const target of DANGEROUS_TARGETS) {
        const escapedFlag = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(`\\b${cmd}\\b[\\s\\S]{0,40}${escapedFlag}[\\s\\S]{0,40}${escapedTarget}`, 'i'));
      }
    }
  }
  return patterns;
})();

export function resolveIntent(input: { text: string }): {
  intent: IntentCategory;
  matchedFeatures: string[];
  score: number;
} {
  const text = input.text.toLowerCase();
  let best: { intent: IntentCategory; matchedFeatures: string[] } = { intent: 'unknown', matchedFeatures: [] };

  for (const [intent, features] of Object.entries(INTENT_FEATURE_MATRIX) as Array<[IntentCategory, string[]]>) {
    if (intent === 'unknown') continue;
    const matchedFeatures = features.filter((feature) => text.includes(feature));
    if (matchedFeatures.length > best.matchedFeatures.length) {
      best = { intent, matchedFeatures };
    }
  }

  const score = best.matchedFeatures.length / Math.max(1, INTENT_FEATURE_MATRIX[best.intent].length);
  return {
    intent: best.intent,
    matchedFeatures: best.matchedFeatures,
    score: Number(score.toFixed(3)),
  };
}

export function checkHighRiskBash(input: { command: string }): {
  blocked: boolean;
  matches: string[];
  totalRegexCount: number;
} {
  const matches: string[] = [];
  for (const regex of HIGH_RISK_BASH_REGEXES) {
    if (regex.test(input.command)) matches.push(regex.source);
    if (matches.length >= 5) break;
  }
  return {
    blocked: matches.length > 0,
    matches,
    totalRegexCount: HIGH_RISK_BASH_REGEXES.length,
  };
}

export function mergePromptStackLayers(input: {
  identity: string[];
  capability: string[];
  context: string[];
  constraint: string[];
}): {
  merged: string;
  layers: { layer: 'identity' | 'capability' | 'context' | 'constraint'; count: number }[];
} {
  const merged = [
    ...input.identity,
    ...input.capability,
    ...input.context,
    ...input.constraint,
  ].filter((x) => x.trim().length > 0).join('\n\n');
  return {
    merged,
    layers: [
      { layer: 'identity', count: input.identity.length },
      { layer: 'capability', count: input.capability.length },
      { layer: 'context', count: input.context.length },
      { layer: 'constraint', count: input.constraint.length },
    ],
  };
}

export type DSXUExperienceContextPack = {
  injectIntoPrompt: boolean
  rendered: string
  tokenEstimate: number
  warnings: readonly string[]
  evidence: {
    recallCount: number
    sourceTruthRefreshRequired: boolean
    rereadFiles: readonly string[]
    planningItemCount: number
    verificationCommandCount: number
    hasFailureAvoidance: boolean
    hasSuccessfulFix: boolean
    hasTraceIndex: boolean
    policy: 'read-only-memory-hint'
  }
}

export function buildDSXUExperienceContextPack(input: {
  injection?: DsxuExperienceInjection | null
  maxRenderedChars?: number
}): DSXUExperienceContextPack {
  const maxRenderedChars = Math.max(256, input.maxRenderedChars ?? 4000)
  const recallCount = input.injection?.recalls.length ?? 0
  if (!input.injection || recallCount === 0) {
    return {
      injectIntoPrompt: false,
      rendered: '',
      tokenEstimate: 0,
      warnings: ['experience-store-empty'],
      evidence: {
        recallCount: 0,
        sourceTruthRefreshRequired: false,
        rereadFiles: [],
        planningItemCount: 0,
        verificationCommandCount: 0,
        hasFailureAvoidance: false,
        hasSuccessfulFix: false,
        hasTraceIndex: false,
        policy: 'read-only-memory-hint',
      },
    }
  }

  const bounded =
    input.injection.rendered.length > maxRenderedChars
      ? `${input.injection.rendered.slice(0, maxRenderedChars)}\n[DSXU ExperienceStore truncated: bounded context pack]`
      : input.injection.rendered
  return {
    injectIntoPrompt: true,
    rendered: bounded,
    tokenEstimate: Math.max(1, Math.ceil(bounded.length / 4)),
    warnings: input.injection.memory.warnings,
    evidence: {
      recallCount,
      sourceTruthRefreshRequired: input.injection.memory.sourceTruthRefreshRequired,
      rereadFiles: input.injection.memory.rereadFiles,
      planningItemCount: input.injection.planning.evidence.itemCount,
      verificationCommandCount: input.injection.planning.verificationCommands.length,
      hasFailureAvoidance: input.injection.planning.evidence.hasFailureAvoidance,
      hasSuccessfulFix: input.injection.planning.evidence.hasSuccessfulFix,
      hasTraceIndex: input.injection.planning.evidence.hasTraceIndex,
      policy: 'read-only-memory-hint',
    },
  }
}

export function analyzeContextWeighted(input: {
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
}): {
  total: number;
  selected: Array<{ role: string; weight: number; tokens: number }>;
} {
  const weights: Record<string, number> = { error: 1.0, tool: 0.8, user: 0.6, assistant: 0.5, result: 0.9 };
  const scored = input.messages.map((message) => {
    const tokens = Math.max(1, Math.floor(message.content.length / 4));
    const roleWeight = weights[message.role] ?? 0.4;
    return { role: message.role, weight: roleWeight, tokens };
  });
  const sorted = [...scored].sort((a, b) => b.weight - a.weight);
  let budget = Math.max(1, input.maxTokens);
  const selected: Array<{ role: string; weight: number; tokens: number }> = [];
  for (const item of sorted) {
    if (item.tokens > budget) continue;
    selected.push(item);
    budget -= item.tokens;
  }
  return {
    total: selected.reduce((sum, x) => sum + x.tokens, 0),
    selected,
  };
}

export interface DSXUQueryPromptMainlineBundleInput {
  taskId: string
  query: string
  command?: string
  model: string
  messages: Array<{ role: string; content: string }>
  usage: {
    input_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  autoCompactEnabled: boolean
  promptLayers: {
    identity: string[]
    capability: string[]
    context: string[]
    constraint: string[]
  }
  experienceStore?: {
    injection: DsxuExperienceInjection
    maxRenderedChars?: number
  }
}

export function createDSXUQueryPromptMainlineBundle(
  input: DSXUQueryPromptMainlineBundleInput,
): {
  intent: ReturnType<typeof resolveIntent>
  bashRisk: ReturnType<typeof checkHighRiskBash>
  analysis: ReturnType<typeof analyzeContext>
  suggestions: ReturnType<typeof generateContextSuggestions>
  profiler: ReturnType<typeof queryProfiler>
  guard: ReturnType<typeof queryGuard>
  mergedPrompt: ReturnType<typeof mergePromptStackLayers>
  weightedContext: ReturnType<typeof analyzeContextWeighted>
  experienceContext: DSXUExperienceContextPack
  evidence: {
    querySource: string
    usedPercent: number
    shouldCompact: boolean
    compactionStrategy: 'none' | 'light' | 'aggressive'
    experienceStoreInjected: boolean
    experienceStoreTokenEstimate: number
    experienceStoreRequiresSourceRefresh: boolean
    experienceStorePlanningItems: number
    experienceStoreVerificationCommands: number
    experienceStoreFailureAvoidance: boolean
    experienceStoreSuccessfulFix: boolean
  }
} {
  const contextWindowModule = require('./context-window-manager-v1')
  const intent = resolveIntent({ text: input.query })
  const bashRisk = checkHighRiskBash({ command: input.command ?? '' })
  const helper = queryHelpers({
    query: input.query,
    source: 'main',
    tags: [`intent:${intent.intent}`],
  })

  const contextWindow = contextWindowModule.getContextWindowForModel(input.model)
  const usagePercentages = contextWindowModule.calculateContextPercentages(input.usage, contextWindow)
  const experienceContext = buildDSXUExperienceContextPack({
    injection: input.experienceStore?.injection,
    maxRenderedChars: input.experienceStore?.maxRenderedChars,
  })
  const rawAnalysis = analyzeContext({
    messages: input.messages,
    rawMaxTokens: contextWindow,
    memoryTokens: input.usage.cache_creation_input_tokens + experienceContext.tokenEstimate,
    toolResultTokens: input.usage.input_tokens,
    duplicateReadTokens: input.usage.cache_read_input_tokens,
  })
  const suggestions = generateContextSuggestions({
    percentage: rawAnalysis.percentage,
    duplicateReadTokens: input.usage.cache_read_input_tokens,
    autoCompactEnabled: input.autoCompactEnabled,
  })
  const profiler = queryProfiler({
    query: helper.normalizedQuery,
    estimatedContextTokens: rawAnalysis.totalTokens,
  })
  const guard = queryGuard({
    estimatedTokens: rawAnalysis.totalTokens,
    contextWindowSize: contextWindow,
  })
  const weightedContext = analyzeContextWeighted({
    messages: input.messages,
    maxTokens: Math.max(1, Math.floor(contextWindow * 0.2)),
  })
  const mergedPrompt = mergePromptStackLayers({
    ...input.promptLayers,
    context: [
      ...input.promptLayers.context,
      ...(experienceContext.injectIntoPrompt ? [experienceContext.rendered] : []),
    ],
  })
  const shouldCompact = contextWindowModule.shouldTriggerAutoCompact({
    usedPercent: usagePercentages.used ?? rawAnalysis.percentage,
    autoCompactEnabled: input.autoCompactEnabled,
    threshold: 80,
  })
  const compaction = contextWindowModule.getCompactionStrategy({
    usedPercent: usagePercentages.used ?? rawAnalysis.percentage,
    duplicateReadPercent: Math.round(((input.usage.cache_read_input_tokens || 0) / Math.max(1, contextWindow)) * 100),
  })

  return {
    intent,
    bashRisk,
    analysis: rawAnalysis,
    suggestions,
    profiler,
    guard,
    mergedPrompt,
    weightedContext,
    experienceContext,
    evidence: {
      querySource: helper.querySource,
      usedPercent: usagePercentages.used ?? rawAnalysis.percentage,
      shouldCompact,
      compactionStrategy: compaction.strategy,
      experienceStoreInjected: experienceContext.injectIntoPrompt,
      experienceStoreTokenEstimate: experienceContext.tokenEstimate,
      experienceStoreRequiresSourceRefresh: experienceContext.evidence.sourceTruthRefreshRequired,
      experienceStorePlanningItems: experienceContext.evidence.planningItemCount,
      experienceStoreVerificationCommands: experienceContext.evidence.verificationCommandCount,
      experienceStoreFailureAvoidance: experienceContext.evidence.hasFailureAvoidance,
      experienceStoreSuccessfulFix: experienceContext.evidence.hasSuccessfulFix,
    },
  }
}
