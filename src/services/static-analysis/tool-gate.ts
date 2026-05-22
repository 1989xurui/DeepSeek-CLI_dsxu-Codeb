import { createStaticAnalysisBridge } from './bridge';

export interface StaticAnalysisToolGateInput {
  filePaths: string[];
  patchContent: string;
}

export interface StaticAnalysisToolGateResult {
  status: 'SKIPPED' | 'PASS' | 'FAIL' | 'PARTIAL';
  shouldBlock: boolean;
  issues: number;
  error?: string;
  semantics?: 'skipped' | 'advisory-envelope' | 'static-analysis';
  policy?: StaticAnalysisToolGatePolicy;
}

export interface StaticAnalysisToolGatePolicy {
  enabled: boolean;
  runAnalysis: boolean;
  blocking: boolean;
  riskLevel: 'normal' | 'risk-blocking';
  reason: string;
  matchedRule?: string;
}

export async function invokeStaticAnalysisToolGate(
  input: StaticAnalysisToolGateInput,
): Promise<StaticAnalysisToolGateResult> {
  const policy = buildStaticAnalysisToolGatePolicy(input.filePaths);

  if (!policy.enabled) {
    return {
      status: 'SKIPPED',
      shouldBlock: false,
      issues: 0,
      semantics: 'skipped',
      policy,
    };
  }

  const releaseClaimHygieneIssue = detectReleaseClaimSourceHygieneIssue(input.patchContent);
  if (releaseClaimHygieneIssue) {
    return {
      status: 'FAIL',
      shouldBlock: true,
      issues: 1,
      error: releaseClaimHygieneIssue,
      semantics: 'static-analysis',
      policy: {
        ...policy,
        runAnalysis: true,
        blocking: true,
        riskLevel: 'risk-blocking',
        reason: 'release/readme claim source hygiene requires a DSXU-owned positive evidence allowlist',
        matchedRule: 'release-claim-source-hygiene',
      },
    };
  }

  if (!policy.runAnalysis) {
    return {
      status: 'PARTIAL',
      shouldBlock: false,
      issues: 0,
      semantics: 'advisory-envelope',
      error:
        'Static analysis gate recorded a post-mutation advisory envelope. ' +
        'Set DSXU_STATIC_ANALYSIS_TOOL_GATE=1 to run the bridge.',
      policy,
    };
  }

  try {
    const bridge = createStaticAnalysisBridge({
      enabled: true,
      failOnCritical: policy.blocking,
      maxCriticalIssues: 0,
      gateOptions: {
        shortCircuitOnError: true,
        maxDurationMs: readIntEnv('DSXU_STATIC_ANALYSIS_TOOL_GATE_TIMEOUT_MS', 10_000),
      },
    });
    const analysis = await bridge.analyzeAfterPatch({
      filePaths: input.filePaths,
      patchContent: input.patchContent,
      timestamp: new Date(),
    });

    return {
      status: analysis.result.passed ? 'PASS' : 'FAIL',
      shouldBlock: policy.blocking && analysis.shouldBlock,
      issues: analysis.result.totalIssues,
      error: analysis.blockReason,
      semantics: 'static-analysis',
      policy,
    };
  } catch (error) {
    return {
      status: 'FAIL',
      shouldBlock: policy.blocking,
      issues: 1,
      error: error instanceof Error ? error.message : String(error),
      semantics: 'static-analysis',
      policy,
    };
  }
}

export function buildStaticAnalysisToolGatePolicy(filePaths: string[]): StaticAnalysisToolGatePolicy {
  const enabled = !isEnvExplicitFalse(process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE);
  const explicitRun = isEnvTruthy(process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE);
  const explicitBlocking = isEnvTruthy(process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE_BLOCKING);
  const risk = classifyStaticAnalysisRisk(filePaths);

  if (!enabled) {
    return {
      enabled: false,
      runAnalysis: false,
      blocking: false,
      riskLevel: risk.riskLevel,
      reason: 'explicitly disabled by DSXU_STATIC_ANALYSIS_TOOL_GATE',
      matchedRule: risk.matchedRule,
    };
  }

  return {
    enabled: true,
    runAnalysis: explicitRun || risk.riskLevel === 'risk-blocking',
    blocking: explicitBlocking || risk.riskLevel === 'risk-blocking',
    riskLevel: risk.riskLevel,
    reason: explicitRun
      ? 'explicit static analysis run requested'
      : risk.reason,
    matchedRule: risk.matchedRule,
  };
}

function classifyStaticAnalysisRisk(filePaths: string[]): Pick<
  StaticAnalysisToolGatePolicy,
  'riskLevel' | 'reason' | 'matchedRule'
> {
  const normalized = filePaths.map(path => path.replace(/\\/g, '/').toLowerCase());
  const rules: Array<{ name: string; pattern: RegExp; reason: string }> = [
    {
      name: 'secret-or-env-config',
      pattern: /(^|\/)(\.env($|\.)|.*(secret|credential|apikey|api-key|token|private-key).*)/,
      reason: 'secret or environment configuration edits require blocking evidence',
    },
    {
      name: 'provider-route-cost-cache',
      pattern: /(^|\/)(src\/services\/api|src\/dsxu\/engine\/(llm|model|provider|deepseek|cost|cache|route)|src\/utils\/model)\//,
      reason: 'provider route/cost/cache edits require blocking evidence',
    },
    {
      name: 'tool-permission-mutation',
      pattern: /(^|\/)(src\/tools|src\/services\/static-analysis|src\/coordinator\/tdd-gate|src\/dsxu\/engine\/(permission|tool|runtime|recovery))\//,
      reason: 'tool, permission, runtime, or verification edits require blocking evidence',
    },
    {
      name: 'agent-mcp-skill',
      pattern: /(^|\/)(src\/dsxu\/engine\/(agent|mcp|skill)|src\/services\/mcp|src\/services\/skills)\//,
      reason: 'agent, MCP, and skill ownership edits require blocking evidence',
    },
    {
      name: 'release-benchmark-evidence',
      pattern: /(^|\/)(scripts\/dsxu-.*(release|benchmark|evidence|swe|acceptance|six-stage)|docs\/generated\/)/,
      reason: 'release, benchmark, and evidence edits require blocking evidence',
    },
  ];

  for (const path of normalized) {
    const rule = rules.find(candidate => candidate.pattern.test(path));
    if (rule) {
      return {
        riskLevel: 'risk-blocking',
        reason: rule.reason,
        matchedRule: rule.name,
      };
    }
  }

  return {
    riskLevel: 'normal',
    reason: 'normal source edit uses visible advisory envelope unless explicitly escalated',
  };
}

const RELEASE_CLAIM_SURFACE_PATTERN =
  /\b(canPublishClaim|buildReadmeClaim|targetManifest|release\s+claim|public\s+claim|readme\s+claim)\b/i;

const DISALLOWED_RELEASE_CLAIM_TOKEN_PATTERN = new RegExp(
  [
    ['G', 'PT'].join(''),
    ['Cl', 'aude'].join(''),
    ['95', '%'].join(''),
    ['SWE', '-bench'].join(''),
    ['Terminal', '-Bench'].join(''),
    ['OS', 'World'].join(''),
    ['tau', '-bench'].join(''),
  ].map(escapeRegExp).join('|'),
  'i',
);

function detectReleaseClaimSourceHygieneIssue(patchContent: string): string | undefined {
  const postMutationText = extractPostMutationText(patchContent);
  if (!RELEASE_CLAIM_SURFACE_PATTERN.test(postMutationText)) return undefined;
  const match = postMutationText.match(DISALLOWED_RELEASE_CLAIM_TOKEN_PATTERN)?.[0];
  if (!match) return undefined;
  return [
    'Release/readme claim source contains external parity, external benchmark, or percent capability token after mutation.',
    'Use a DSXU-owned positive evidence allowlist and keep benchmark/parity wording outside runtime source.',
    `matched=${redactClaimToken(match)}`,
  ].join(' ');
}

function extractPostMutationText(patchContent: string): string {
  if (!/(^|\n)@@/.test(patchContent)) return patchContent;
  return patchContent
    .split(/\r?\n/)
    .filter(line => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) return false;
      return !line.startsWith('-');
    })
    .map(line => line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line)
    .join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactClaimToken(value: string): string {
  if (value.includes('%')) return '[percent-capability-token]';
  return '[external-claim-token]';
}

function isEnvTruthy(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

function isEnvExplicitFalse(value: string | undefined): boolean {
  return value === '0' || value?.toLowerCase() === 'false' || value?.toLowerCase() === 'no';
}

function readIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
