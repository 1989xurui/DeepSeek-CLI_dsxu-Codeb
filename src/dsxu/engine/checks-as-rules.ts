/**
 * DSXU Checks as Rules - 规则化检查系统
 *
 * 将代码检查、验证逻辑抽象为可配置的规则
 * 9A-C: 核心结构定义
 */

/**
 * 规则类别
 */
export type CheckRuleCategory = 'syntax' | 'dangerous_change' | 'verification' | 'style' | 'security' | 'performance'

/**
 * 规则严重程度
 */
export type CheckRuleSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * 规则适用阶段
 */
export type CheckRulePhase = 'verify' | 'review' | 'plan' | 'edit' | 'session'

/**
 * 规则条件类型
 */
export type CheckRuleConditionType = 'simple' | 'regex' | 'ast' | 'custom'

/**
 * 规则动作类型
 */
export type CheckRuleActionType = 'warn' | 'error' | 'suggest' | 'auto_fix' | 'require_approval'

/**
 * 规则条件 - 核心结构定义
 */
export interface CheckRuleCondition {
  /** 条件类型 */
  type: CheckRuleConditionType
  /** 条件表达式（根据类型不同而不同） */
  expression: string
  /** 条件描述 */
  description?: string
  /** 条件参数 */
  params?: Record<string, any>
}

/**
 * 规则动作 - 核心结构定义
 */
export interface CheckRuleAction {
  /** 动作类型 */
  type: CheckRuleActionType
  /** 动作消息（显示给用户） */
  message: string
  /** 动作详情 */
  details?: string
  /** 修复建议（如果是 auto_fix 类型） */
  fixSuggestion?: string
  /** 动作参数 */
  params?: Record<string, any>
}

/**
 * 规则元数据
 */
export interface CheckRuleMetadata {
  /** 创建者 */
  author?: string
  /** 创建时间 */
  createdAt?: number
  /** 最后修改时间 */
  updatedAt?: number
  /** 规则版本 */
  version?: string
  /** 相关文档链接 */
  documentation?: string
  /** 规则权重（0-100） */
  weight?: number
  /** 自定义扩展字段 */
  extensions?: Record<string, any>
}

/**
 * 检查规则 - 核心结构定义
 */
export interface CheckRule {
  /** 规则唯一标识符 */
  id: string
  /** 规则名称 */
  name: string
  /** 规则类别 */
  category: CheckRuleCategory
  /** 规则严重程度 */
  severity: CheckRuleSeverity
  /** 规则描述 */
  description: string
  /** 规则条件 */
  condition: CheckRuleCondition
  /** 规则动作 */
  action: CheckRuleAction
  /** 是否启用 */
  enabled: boolean
  /** 适用阶段 */
  appliesToPhase: CheckRulePhase[]
  /** 规则标签 */
  tags: string[]
  /** 规则元数据 */
  metadata?: CheckRuleMetadata
}

/**
 * 规则检查结果状态
 */
export type CheckRuleResultStatus = 'passed' | 'failed' | 'warning' | 'skipped' | 'error'

/**
 * 规则检查结果 - 核心结构定义
 */
export interface CheckRuleResult {
  /** 结果唯一标识符 */
  id: string
  /** 关联的规则ID */
  ruleId: string
  /** 检查结果状态 */
  status: CheckRuleResultStatus
  /** 检查时间戳 */
  checkedAt: number
  /** 检查目标（文件路径、代码片段等） */
  target: string
  /** 检查详情 */
  details?: string
  /** 错误消息（如果检查失败） */
  errorMessage?: string
  /** 建议修复方案 */
  fixSuggestion?: string
  /** 检查上下文 */
  context?: Record<string, any>
  /** 结果元数据 */
  metadata?: {
    /** 执行耗时（毫秒） */
    executionTime?: number
    /** 资源消耗 */
    resourceUsage?: Record<string, any>
    /** 自定义扩展字段 */
    extensions?: Record<string, any>
  }
}

/**
 * 规则检查结果集
 */
export interface CheckRuleResultSet {
  /** 结果集ID */
  id: string
  /** 关联的任务ID */
  taskId?: string
  /** 检查阶段 */
  phase: CheckRulePhase
  /** 所有检查结果 */
  results: CheckRuleResult[]
  /** 检查开始时间 */
  startedAt: number
  /** 检查结束时间 */
  completedAt: number
  /** 统计信息 */
  stats: {
    /** 总规则数 */
    totalRules: number
    /** 通过数 */
    passed: number
    /** 失败数 */
    failed: number
    /** 警告数 */
    warnings: number
    /** 跳过数 */
    skipped: number
    /** 错误数 */
    errors: number
  }
  /** 结果集元数据 */
  metadata?: Record<string, any>
}

/**
 * 创建检查规则
 *
 * @param params 规则参数
 * @returns 创建的检查规则
 */
export function createCheckRule(params: {
  id: string
  name: string
  category: CheckRuleCategory
  severity: CheckRuleSeverity
  description: string
  condition: CheckRuleCondition
  action: CheckRuleAction
  enabled?: boolean
  appliesToPhase?: CheckRulePhase[]
  tags?: string[]
  metadata?: CheckRuleMetadata
}): CheckRule {
  const now = Date.now()

  return {
    id: params.id,
    name: params.name,
    category: params.category,
    severity: params.severity,
    description: params.description,
    condition: params.condition,
    action: params.action,
    enabled: params.enabled ?? true,
    appliesToPhase: params.appliesToPhase ?? ['verify', 'review'],
    tags: params.tags ?? [],
    metadata: params.metadata ? {
      ...params.metadata,
      createdAt: params.metadata.createdAt ?? now,
      updatedAt: now
    } : {
      createdAt: now,
      updatedAt: now
    }
  }
}

/**
 * 创建规则条件
 */
export function createCheckRuleCondition(params: {
  type: CheckRuleConditionType
  expression: string
  description?: string
  params?: Record<string, any>
}): CheckRuleCondition {
  return {
    type: params.type,
    expression: params.expression,
    description: params.description,
    params: params.params
  }
}

/**
 * 创建规则动作
 */
export function createCheckRuleAction(params: {
  type: CheckRuleActionType
  message: string
  details?: string
  fixSuggestion?: string
  params?: Record<string, any>
}): CheckRuleAction {
  return {
    type: params.type,
    message: params.message,
    details: params.details,
    fixSuggestion: params.fixSuggestion,
    params: params.params
  }
}

/**
 * 创建规则检查结果
 */
export function createCheckRuleResult(params: {
  id: string
  ruleId: string
  status: CheckRuleResultStatus
  target: string
  details?: string
  errorMessage?: string
  fixSuggestion?: string
  context?: Record<string, any>
  metadata?: {
    executionTime?: number
    resourceUsage?: Record<string, any>
    extensions?: Record<string, any>
  }
}): CheckRuleResult {
  return {
    id: params.id,
    ruleId: params.ruleId,
    status: params.status,
    checkedAt: Date.now(),
    target: params.target,
    details: params.details,
    errorMessage: params.errorMessage,
    fixSuggestion: params.fixSuggestion,
    context: params.context,
    metadata: params.metadata
  }
}

/**
 * 创建规则检查结果集
 */
export function createCheckRuleResultSet(params: {
  id: string
  phase: CheckRulePhase
  results: CheckRuleResult[]
  taskId?: string
  startedAt?: number
  completedAt?: number
  metadata?: Record<string, any>
}): CheckRuleResultSet {
  const now = Date.now()
  const startedAt = params.startedAt ?? now
  const completedAt = params.completedAt ?? now

  // 计算统计信息
  const stats = {
    totalRules: params.results.length,
    passed: params.results.filter(r => r.status === 'passed').length,
    failed: params.results.filter(r => r.status === 'failed').length,
    warnings: params.results.filter(r => r.status === 'warning').length,
    skipped: params.results.filter(r => r.status === 'skipped').length,
    errors: params.results.filter(r => r.status === 'error').length
  }

  return {
    id: params.id,
    taskId: params.taskId,
    phase: params.phase,
    results: params.results,
    startedAt,
    completedAt,
    stats,
    metadata: params.metadata
  }
}

/**
 * 创建示例规则 - 语法检查规则
 */
export function createSyntaxCheckRule(): CheckRule {
  return createCheckRule({
    id: 'syntax-check-001',
    name: 'TypeScript 语法检查',
    category: 'syntax',
    severity: 'high',
    description: '检查 TypeScript 代码语法是否正确',
    condition: createCheckRuleCondition({
      type: 'simple',
      expression: 'file_extension == ".ts" || file_extension == ".tsx"',
      description: '仅检查 TypeScript 文件'
    }),
    action: createCheckRuleAction({
      type: 'error',
      message: 'TypeScript 语法错误',
      details: '代码包含 TypeScript 语法错误，需要修复后才能继续',
      fixSuggestion: '运行 tsc --noEmit 检查具体错误'
    }),
    appliesToPhase: ['verify', 'review'],
    tags: ['typescript', 'syntax', 'validation']
  })
}

/**
 * 创建示例规则 - 危险变更检查规则
 */
export function createDangerousChangeCheckRule(): CheckRule {
  return createCheckRule({
    id: 'dangerous-change-001',
    name: '危险文件修改检查',
    category: 'dangerous_change',
    severity: 'critical',
    description: '检查是否修改了关键系统文件',
    condition: createCheckRuleCondition({
      type: 'regex',
      expression: '.*(package\\.json|tsconfig\\.json|dockerfile|deployment\\.yaml).*',
      description: '匹配关键配置文件'
    }),
    action: createCheckRuleAction({
      type: 'require_approval',
      message: '检测到关键文件修改',
      details: '修改了 package.json、tsconfig.json 等关键配置文件，需要额外审查',
      fixSuggestion: '确保修改经过充分测试和审查'
    }),
    appliesToPhase: ['review'],
    tags: ['security', 'dangerous', 'config']
  })
}

/**
 * 创建示例规则 - 验证规则
 */
export function createVerificationCheckRule(): CheckRule {
  return createCheckRule({
    id: 'verification-001',
    name: '单元测试覆盖率检查',
    category: 'verification',
    severity: 'medium',
    description: '检查代码变更是否包含足够的单元测试',
    condition: createCheckRuleCondition({
      type: 'custom',
      expression: 'has_test_coverage',
      description: '检查测试覆盖率是否达标'
    }),
    action: createCheckRuleAction({
      type: 'warn',
      message: '测试覆盖率不足',
      details: '新增或修改的代码缺少足够的单元测试覆盖',
      fixSuggestion: '为变更添加相应的单元测试'
    }),
    appliesToPhase: ['verify'],
    tags: ['testing', 'quality', 'verification']
  })
}
