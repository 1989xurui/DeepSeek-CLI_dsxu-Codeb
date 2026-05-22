import type { AgentRole } from './coordinator-types-v1'

export type TaskAnalysis = {
  taskId: string
  taskTitle: string
  complexity: 'low' | 'medium' | 'high'
  riskLevel: 'low' | 'medium' | 'high'
  verificationRequirement: 'none' | 'independent' | 'strict'
  contextOverlapPreference: 'either' | 'continue' | 'fresh'
  recommendedRoles: AgentRole[]
  validationRequirements: {
    level: 'none' | 'independent' | 'strict'
    requiredRoles: AgentRole[]
  }
  coordinatorDecision: null | { coordinatorRole: AgentRole; reason: string }
  contextManagement: {
    contextSharing: boolean
    isolationRequirements: string[]
  }
  dependencies: {
    externalDependencies: string[]
    dependencyComplexity: 'low' | 'medium' | 'high'
  }
  riskAnalysis: {
    identifiedRisks: string[]
    overallRiskScore: number
    riskMitigationPlan: string[]
  }
  qualityMetrics: {
    documentationNeeds: 'low' | 'medium' | 'high'
    testability: number
    maintainability: number
    reviewComplexity: number
  }
  dsxuParityScore: number
  absorptionLevel: 'none' | 'partial' | 'full' | 'enhanced'
}

export class TaskAnalyzer {
  constructor(private readonly config = TaskAnalyzer.getDefaultConfig()) {}

  static getDefaultConfig() {
    return {
      highRiskTerms: [
        'security',
        'payment',
        'auth',
        '安全',
        '支付',
        '敏感',
        '瀹夊叏',
        '鏀粯',
        '鏁忔劅',
      ],
      highComplexityTerms: [
        'refactor',
        'architecture',
        'microservice',
        '重构',
        '架构',
        '微服务',
        '复杂',
        '閲嶆瀯',
        '绯荤粺',
        '鏋舵瀯',
      ],
    }
  }

  async analyzeTask(taskId: string, taskTitle: string, description: string): Promise<TaskAnalysis> {
    const text = `${taskTitle}\n${description}`
    const complexity = this.analyzeComplexity(text)
    const riskLevel = this.analyzeRiskLevel(text)
    const contextOverlapPreference = this.analyzeContextPreference(text)
    const recommendedRoles = this.recommendRoles(complexity, riskLevel)
    const validationLevel =
      riskLevel === 'high' ? 'strict' : complexity === 'medium' ? 'independent' : 'none'
    const roleAnalysis = {
      recommendedRoles,
      roleRationale: Object.fromEntries(recommendedRoles.map((role) => [role, 'owner fit'])),
      roleSuitability: Object.fromEntries(recommendedRoles.map((role) => [role, 80])),
    }
    const dsxuParityScore = this.calculateDSXUParityScore(roleAnalysis, { appliedRules: [] }, null)

    return {
      taskId,
      taskTitle,
      complexity,
      riskLevel,
      verificationRequirement: validationLevel,
      contextOverlapPreference,
      recommendedRoles,
      validationRequirements: {
        level: validationLevel,
        requiredRoles: validationLevel === 'strict' ? ['verifier' as AgentRole] : [],
      },
      coordinatorDecision:
        complexity === 'high'
          ? { coordinatorRole: 'coordinator' as AgentRole, reason: 'high complexity task' }
          : null,
      contextManagement: {
        contextSharing: contextOverlapPreference !== 'fresh',
        isolationRequirements:
          contextOverlapPreference === 'fresh' ? ['全新工作空间'] : [],
      },
      dependencies: this.analyzeDependencies(text),
      riskAnalysis: this.buildRiskAnalysis(riskLevel, text),
      qualityMetrics: {
        documentationNeeds: /doc|API|鏂囨。|REST/i.test(text) ? 'high' : 'medium',
        testability: riskLevel === 'high' ? 0.7 : 0.85,
        maintainability: complexity === 'high' ? 0.65 : 0.85,
        reviewComplexity: complexity === 'high' ? 0.9 : 0.4,
      },
      dsxuParityScore,
      absorptionLevel:
        dsxuParityScore >= 85 ? 'enhanced' : dsxuParityScore >= 70 ? 'full' : 'partial',
    }
  }

  private analyzeComplexity(text: string): 'low' | 'medium' | 'high' {
    if (this.config.highComplexityTerms.some((term) => text.includes(term))) return 'high'
    if (/API|REST|new|feature|实现|新功能|开发|瀹炵幇|寮€鍙|鏂板姛/i.test(text)) return 'medium'
    return 'low'
  }

  private analyzeRiskLevel(text: string): 'low' | 'medium' | 'high' {
    if (this.config.highRiskTerms.some((term) => text.includes(term))) return 'high'
    if (/API|REST|auth|integration|接口|集成|鎺ュ彛|闆嗘垚/i.test(text)) return 'medium'
    return 'low'
  }

  private calculateDSXUParityScore(
    roleAnalysis: { recommendedRoles: AgentRole[] },
    ruleAnalysis: unknown,
    coordinatorDecision: unknown
  ): number {
    let score = 60 + roleAnalysis.recommendedRoles.length * 8
    if (coordinatorDecision) score += 10
    return Math.max(0, Math.min(100, score))
  }

  private analyzeContextPreference(text: string): 'either' | 'continue' | 'fresh' {
    if (/continue|previous|继续|之前|基于|缁х画|涔嬪墠|鍩轰簬/i.test(text)) return 'continue'
    if (/from scratch|new module|从头|全新|浠庡ご|鍏ㄦ柊/i.test(text)) return 'fresh'
    return 'either'
  }

  private recommendRoles(complexity: string, riskLevel: string): AgentRole[] {
    const roles: AgentRole[] = ['worker' as AgentRole, 'implementer' as AgentRole]
    if (complexity !== 'low') roles.push('explorer' as AgentRole)
    if (complexity === 'high') {
      roles.push('researcher' as AgentRole, 'specialist' as AgentRole)
    }
    if (riskLevel === 'high') roles.push('verifier' as AgentRole)
    return Array.from(new Set(roles))
  }

  private analyzeDependencies(text: string): TaskAnalysis['dependencies'] {
    const deps: string[] = []
    if (/API/i.test(text)) deps.push('API')
    if (/third|第三方|绗笁|涓夋柟/i.test(text)) deps.push('第三方')
    return {
      externalDependencies: deps,
      dependencyComplexity: deps.length > 0 ? 'medium' : 'low',
    }
  }

  private buildRiskAnalysis(riskLevel: string, text: string): TaskAnalysis['riskAnalysis'] {
    const identifiedRisks =
      riskLevel === 'high'
        ? ['security-sensitive path', 'strict verification required']
        : riskLevel === 'medium'
          ? ['integration behavior may regress']
          : []
    return {
      identifiedRisks,
      overallRiskScore: riskLevel === 'high' ? 0.9 : riskLevel === 'medium' ? 0.55 : 0.2,
      riskMitigationPlan:
        identifiedRisks.length > 0
          ? ['run focused verification', 'record owner evidence']
          : ['standard focused test'],
    }
  }
}
