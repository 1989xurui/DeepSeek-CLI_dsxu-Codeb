export type V18SkillTrigger = {
  skill: string
  confidence: number
  reason: string
  activation: 'user_goal' | 'system_runtime'
}

const SKILL_RULES: Array<{
  skill: string
  confidence: number
  patterns: RegExp[]
  reason: string
}> = [
  {
    skill: 'code-review',
    confidence: 0.94,
    patterns: [
      /code[- ]?review|review|pull request|\bPR\b|risk finding/i,
      /代码审查|审查|评审|风险|变更检查|找问题/i,
    ],
    reason: 'goal asks for code review, risk finding, or PR inspection',
  },
  {
    skill: 'tdd',
    confidence: 0.91,
    patterns: [
      /TDD|test[- ]?first|red[- ]?green|failing test|missing tests?/i,
      /测试驱动|先写测试|补测试|红绿|失败测试/i,
    ],
    reason: 'goal asks for test-first implementation or missing tests',
  },
  {
    skill: 'security',
    confidence: 0.9,
    patterns: [
      /security|vulnerab|injection|permission|secret|credential|authz|authn/i,
      /安全|漏洞|注入|权限|密钥|凭据|越权|泄露/i,
    ],
    reason: 'goal mentions security, permissions, injection, or secrets',
  },
  {
    skill: 'context-compression',
    confidence: 0.88,
    patterns: [
      /compact|compress|context[- ]?compression|resume|long context/i,
      /压缩|上下文|长上下文|恢复|续跑|接着做/i,
    ],
    reason: 'goal asks to compact context or resume from a compressed brief',
  },
  {
    skill: 'prompt-cache',
    confidence: 0.86,
    patterns: [
      /prompt[- ]?cache|cache|token|cost|usage|reuse/i,
      /缓存|成本|计费|费用|省 token|复用/i,
    ],
    reason: 'goal asks for cost, token, or prompt-cache optimization',
  },
  {
    skill: 'workflow',
    confidence: 0.84,
    patterns: [
      /workflow|delivery|feature|bugfix|release|end[- ]?to[- ]?end/i,
      /工作流|流程|交付|修复|实现|验收|跑到底/i,
    ],
    reason: 'goal asks for an end-to-end coding delivery workflow',
  },
]

export function selectV18SkillsForGoal(goal: string): V18SkillTrigger[] {
  const text = goal.trim()
  if (!text) return []

  const triggers = SKILL_RULES.filter(rule =>
    rule.patterns.some(pattern => pattern.test(text)),
  ).map(rule => ({
    skill: rule.skill,
    confidence: rule.confidence,
    reason: rule.reason,
    activation: 'user_goal' as const,
  }))

  if (triggers.length === 0) {
    return [
      {
        skill: 'workflow',
        confidence: 0.55,
        reason: 'fallback to deterministic coding workflow for ambiguous goals',
        activation: 'system_runtime',
      },
    ]
  }

  return triggers.sort((a, b) => b.confidence - a.confidence)
}
