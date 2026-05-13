/**
 * Classifier - 分类器
 *
 * V8-2 Runtime Core: Memory/Context/Compact 承接层
 *
 * 对话内容分类，支持记忆标签、任务类型、复杂度等维度
 */

import type { Message, LLMCallFn } from '../types'
import type { Memory } from '../memory-extractor'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'

// ── 类型定义 ──

export interface ClassifierConfig {
  /** 是否启用分类器 */
  enabled: boolean
  /** 分类维度 */
  dimensions: {
    /** 任务类型分类 */
    taskType: boolean
    /** 复杂度分类 */
    complexity: boolean
    /** 风险等级分类 */
    riskLevel: boolean
    /** 技术领域分类 */
    domain: boolean
    /** 动作类型分类 */
    actionType: boolean
    /** 记忆标签分类 */
    memoryTags: boolean
  }
  /** 分类方法 */
  methods: {
    /** 使用规则分类 */
    ruleBased: boolean
    /** 使用LLM分类 */
    llmBased: boolean
    /** 使用混合方法 */
    hybrid: boolean
  }
  /** LLM分类配置 */
  llmClassification: {
    /** 最小置信度阈值 */
    minConfidence: number
    /** 最大分类数量 */
    maxClassifications: number
    /** 是否返回解释 */
    includeExplanations: boolean
  }
  /** 记忆集成 */
  memoryIntegration: {
    /** 为记忆生成标签 */
    generateTagsForMemories: boolean
    /** 使用历史记忆改进分类 */
    useHistoricalMemories: boolean
    /** 标签质量阈值 */
    tagQualityThreshold: number
  }
}

export interface ClassificationResult {
  /** 分类ID */
  id: string
  /** 分类时间 */
  timestamp: number
  /** 会话ID */
  sessionId: string
  /** 任务ID */
  taskId?: string
  /** 各维度分类结果 */
  dimensions: {
    /** 任务类型 */
    taskType?: {
      label: string
      confidence: number
      explanation?: string
    }
    /** 复杂度 */
    complexity?: {
      label: 'simple' | 'moderate' | 'complex'
      confidence: number
      explanation?: string
    }
    /** 风险等级 */
    riskLevel?: {
      label: 'low' | 'medium' | 'high'
      confidence: number
      explanation?: string
    }
    /** 技术领域 */
    domain?: {
      label: string
      confidence: number
      explanation?: string
    }
    /** 动作类型 */
    actionType?: {
      label: string
      confidence: number
      explanation?: string
    }
  }
  /** 记忆标签 */
  memoryTags: Array<{
    tag: string
    confidence: number
    source: 'rule' | 'llm' | 'memory'
  }>
  /** 总体标签 */
  overallTags: string[]
  /** 建议的处理策略 */
  suggestedStrategies: string[]
  /** 分类方法 */
  method: 'rule' | 'llm' | 'hybrid'
  /** 元数据 */
  metadata: {
    /** 消息数量 */
    messageCount: number
    /** 工具调用数量 */
    toolCallCount: number
    /** 分类耗时（毫秒） */
    classificationTime: number
  }
}

export interface ClassificationContext {
  /** 会话ID */
  sessionId: string
  /** 任务ID */
  taskId?: string
  /** 当前工作目录 */
  cwd: string
  /** 用户查询 */
  query?: string
  /** 相关历史记忆 */
  historicalMemories?: Memory[]
  /** 自定义上下文 */
  custom?: Record<string, any>
}

// ── 预定义分类规则 ──

const TASK_TYPE_KEYWORDS = {
  bug_fix: ['bug', 'error', 'fix', 'crash', 'broken', 'not working', 'issue'],
  feature: ['feature', 'implement', 'add', 'new', 'create', 'build'],
  refactor: ['refactor', 'cleanup', 'improve', 'optimize', 'restructure'],
  test: ['test', 'testcase', 'coverage', 'unit test', 'integration test'],
  document: ['document', 'comment', 'readme', 'doc', 'explain'],
  review: ['review', 'check', 'audit', 'inspect', 'examine'],
  research: ['research', 'investigate', 'explore', 'analyze', 'study']
}

const COMPLEXITY_INDICATORS = {
  simple: {
    maxMessages: 10,
    maxTools: 3,
    keywords: ['simple', 'quick', 'minor', 'small', 'trivial']
  },
  moderate: {
    maxMessages: 30,
    maxTools: 10,
    keywords: ['moderate', 'medium', 'standard', 'typical']
  },
  complex: {
    maxMessages: 100,
    maxTools: 30,
    keywords: ['complex', 'difficult', 'challenging', 'major', 'large']
  }
}

const RISK_INDICATORS = {
  low: {
    keywords: ['readonly', 'query', 'check', 'view', 'list'],
    excludes: ['delete', 'remove', 'drop', 'destroy', 'critical']
  },
  medium: {
    keywords: ['edit', 'update', 'modify', 'change', 'adjust'],
    excludes: ['production', 'live', 'critical', 'security']
  },
  high: {
    keywords: ['delete', 'remove', 'drop', 'destroy', 'critical', 'security', 'production', 'live']
  }
}

const DOMAIN_KEYWORDS = {
  frontend: ['react', 'vue', 'angular', 'ui', 'component', 'css', 'html', 'browser'],
  backend: ['server', 'api', 'database', 'node', 'python', 'java', 'go', 'rust'],
  devops: ['docker', 'kubernetes', 'ci/cd', 'deploy', 'infrastructure', 'aws', 'cloud'],
  testing: ['test', 'jest', 'vitest', 'cypress', 'coverage', 'assert'],
  documentation: ['doc', 'readme', 'comment', 'explain', 'guide', 'tutorial']
}

// ── Classifier 核心类 ──

export class Classifier {
  private config: ClassifierConfig
  private llmCall?: LLMCallFn

  constructor(config?: Partial<ClassifierConfig>) {
    this.config = {
      enabled: true,
      dimensions: {
        taskType: true,
        complexity: true,
        riskLevel: true,
        domain: true,
        actionType: true,
        memoryTags: true
      },
      methods: {
        ruleBased: true,
        llmBased: false, // 默认关闭，需要LLM
        hybrid: false
      },
      llmClassification: {
        minConfidence: 0.6,
        maxClassifications: 5,
        includeExplanations: true
      },
      memoryIntegration: {
        generateTagsForMemories: true,
        useHistoricalMemories: false,
        tagQualityThreshold: 0.5
      },
      ...config
    }
  }

  /**
   * 设置LLM调用函数
   */
  setLLMCallFn(llmCall: LLMCallFn): void {
    this.llmCall = llmCall
  }

  /**
   * 分类对话
   */
  async classify(
    messages: Message[],
    context: ClassificationContext
  ): Promise<ClassificationResult> {
    if (!this.config.enabled) {
      return this.createEmptyResult(context)
    }

    const startTime = Date.now()

    try {
      let result: ClassificationResult

      if (this.config.methods.hybrid && this.llmCall) {
        // 混合方法：规则 + LLM
        result = await this.classifyHybrid(messages, context)
      } else if (this.config.methods.llmBased && this.llmCall) {
        // LLM方法
        result = await this.classifyWithLLM(messages, context)
      } else {
        // 规则方法
        result = this.classifyWithRules(messages, context)
      }

      // 更新元数据
      result.metadata.classificationTime = Date.now() - startTime

      console.log(`[Classifier] Classification completed in ${result.metadata.classificationTime}ms`)

      return result

    } catch (error: any) {
      console.warn(`[Classifier] Classification failed: ${error.message}`)
      // 返回基于规则的结果作为降级
      return this.classifyWithRules(messages, context)
    }
  }

  /**
   * 混合分类方法
   */
  private async classifyHybrid(
    messages: Message[],
    context: ClassificationContext
  ): Promise<ClassificationResult> {
    // 先用规则分类
    const ruleResult = this.classifyWithRules(messages, context)

    // 然后用LLM改进
    if (this.llmCall) {
      try {
        const llmResult = await this.classifyWithLLM(messages, context)

        // 合并结果：优先使用高置信度的分类
        return this.mergeClassifications(ruleResult, llmResult)
      } catch (error: any) {
        console.warn(`[Classifier] LLM classification failed in hybrid mode: ${error.message}`)
        // 返回规则结果
        return ruleResult
      }
    }

    return ruleResult
  }

  /**
   * 使用LLM分类
   */
  private async classifyWithLLM(
    messages: Message[],
    context: ClassificationContext
  ): Promise<ClassificationResult> {
    if (!this.llmCall) {
      throw new Error('LLM call function not set')
    }

    // 准备对话文本
    const conversationText = this.prepareConversationForClassification(messages)

    // 构建提示词
    const prompt = this.buildClassificationPrompt(conversationText, context)

    const response = await this.llmCall(
      [
        { role: 'system', content: 'You are a conversation classifier. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      [],
      { model: DEEPSEEK_V4_FLASH_MODEL, maxTokens: 1500 }
    )

    try {
      const llmResult = JSON.parse(response.content)
      return this.parseLLMClassificationResult(llmResult, messages, context)
    } catch (error: any) {
      console.warn(`[Classifier] Failed to parse LLM classification result: ${error.message}`)
      throw new Error('Invalid LLM classification response')
    }
  }

  /**
   * 使用规则分类
   */
  private classifyWithRules(
    messages: Message[],
    context: ClassificationContext
  ): ClassificationResult {
    const result = this.createEmptyResult(context)
    result.method = 'rule'

    const allText = this.getAllText(messages)

    // 任务类型分类
    if (this.config.dimensions.taskType) {
      result.dimensions.taskType = this.classifyTaskType(allText, messages)
    }

    // 复杂度分类
    if (this.config.dimensions.complexity) {
      result.dimensions.complexity = this.classifyComplexity(messages, allText)
    }

    // 风险等级分类
    if (this.config.dimensions.riskLevel) {
      result.dimensions.riskLevel = this.classifyRiskLevel(allText)
    }

    // 技术领域分类
    if (this.config.dimensions.domain) {
      result.dimensions.domain = this.classifyDomain(allText)
    }

    // 动作类型分类
    if (this.config.dimensions.actionType) {
      result.dimensions.actionType = this.classifyActionType(messages, allText)
    }

    // 生成记忆标签
    if (this.config.dimensions.memoryTags) {
      result.memoryTags = this.generateMemoryTags(result, allText)
      result.overallTags = this.extractOverallTags(result)
    }

    // 生成处理策略建议
    result.suggestedStrategies = this.generateSuggestedStrategies(result)

    return result
  }

  // ── 规则分类方法 ──

  private classifyTaskType(text: string, messages: Message[]): {
    label: string
    confidence: number
    explanation?: string
  } {
    const lowerText = text.toLowerCase()

    // 检查关键词匹配
    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          // 计算置信度：基于关键词匹配数量和位置
          const matches = keywords.filter(k => lowerText.includes(k)).length
          const confidence = Math.min(0.3 + (matches * 0.1), 0.9)

          return {
            label: type,
            confidence,
            explanation: `Matched keywords: ${keywords.filter(k => lowerText.includes(k)).slice(0, 3).join(', ')}`
          }
        }
      }
    }

    // 默认分类
    const toolMessages = messages.filter(m => m.role === 'tool')
    if (toolMessages.length > 0) {
      return {
        label: 'implementation',
        confidence: 0.5,
        explanation: 'Tool usage detected'
      }
    }

    return {
      label: 'discussion',
      confidence: 0.6,
      explanation: 'No specific task type identified'
    }
  }

  private classifyComplexity(messages: Message[], text: string): {
    label: 'simple' | 'moderate' | 'complex'
    confidence: number
    explanation?: string
  } {
    const lowerText = text.toLowerCase()
    let score = 0

    // 基于消息数量
    if (messages.length > COMPLEXITY_INDICATORS.complex.maxMessages) {
      score += 2
    } else if (messages.length > COMPLEXITY_INDICATORS.moderate.maxMessages) {
      score += 1
    }

    // 基于工具调用数量
    const toolMessages = messages.filter(m => m.role === 'tool')
    if (toolMessages.length > COMPLEXITY_INDICATORS.complex.maxTools) {
      score += 2
    } else if (toolMessages.length > COMPLEXITY_INDICATORS.moderate.maxTools) {
      score += 1
    }

    // 基于关键词
    for (const [complexity, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
      for (const keyword of indicators.keywords) {
        if (lowerText.includes(keyword)) {
          if (complexity === 'complex') score += 2
          else if (complexity === 'moderate') score += 1
          break
        }
      }
    }

    // 确定复杂度等级
    if (score >= 3) {
      return {
        label: 'complex',
        confidence: Math.min(0.3 + (score * 0.1), 0.9),
        explanation: `Score: ${score} (messages: ${messages.length}, tools: ${toolMessages.length})`
      }
    } else if (score >= 1) {
      return {
        label: 'moderate',
        confidence: Math.min(0.4 + (score * 0.1), 0.8),
        explanation: `Score: ${score}`
      }
    } else {
      return {
        label: 'simple',
        confidence: 0.7,
        explanation: 'Simple task based on metrics'
      }
    }
  }

  private classifyRiskLevel(text: string): {
    label: 'low' | 'medium' | 'high'
    confidence: number
    explanation?: string
  } {
    const lowerText = text.toLowerCase()

    // 检查高风险关键词
    for (const keyword of RISK_INDICATORS.high.keywords) {
      if (lowerText.includes(keyword)) {
        return {
          label: 'high',
          confidence: 0.8,
          explanation: `Contains high-risk keyword: ${keyword}`
        }
      }
    }

    // 检查中风险关键词
    for (const keyword of RISK_INDICATORS.medium.keywords) {
      if (lowerText.includes(keyword)) {
        // 确保不包含高风险排除词
        let isExcluded = false
        for (const exclude of RISK_INDICATORS.medium.excludes || []) {
          if (lowerText.includes(exclude)) {
            isExcluded = true
            break
          }
        }

        if (!isExcluded) {
          return {
            label: 'medium',
            confidence: 0.7,
            explanation: `Contains medium-risk keyword: ${keyword}`
          }
        }
      }
    }

    // 检查低风险关键词
    for (const keyword of RISK_INDICATORS.low.keywords) {
      if (lowerText.includes(keyword)) {
        // 确保不包含中高风险排除词
        let isExcluded = false
        for (const exclude of [...(RISK_INDICATORS.low.excludes || []), ...RISK_INDICATORS.high.keywords]) {
          if (lowerText.includes(exclude)) {
            isExcluded = true
            break
          }
        }

        if (!isExcluded) {
          return {
            label: 'low',
            confidence: 0.8,
            explanation: `Contains low-risk keyword: ${keyword}`
          }
        }
      }
    }

    // 默认中等风险
    return {
      label: 'medium',
      confidence: 0.5,
      explanation: 'No specific risk indicators found'
    }
  }

  private classifyDomain(text: string): {
    label: string
    confidence: number
    explanation?: string
  } {
    const lowerText = text.toLowerCase()
    const matches: Array<{ domain: string; count: number; keywords: string[] }> = []

    // 检查各领域关键词
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const matchedKeywords = keywords.filter(k => lowerText.includes(k))
      if (matchedKeywords.length > 0) {
        matches.push({
          domain,
          count: matchedKeywords.length,
          keywords: matchedKeywords
        })
      }
    }

    if (matches.length > 0) {
      // 选择匹配最多的领域
      const bestMatch = matches.reduce((best, current) =>
        current.count > best.count ? current : best
      )

      return {
        label: bestMatch.domain,
        confidence: Math.min(0.3 + (bestMatch.count * 0.1), 0.9),
        explanation: `Matched keywords: ${bestMatch.keywords.slice(0, 3).join(', ')}`
      }
    }

    return {
      label: 'general',
      confidence: 0.6,
      explanation: 'No specific domain identified'
    }
  }

  private classifyActionType(messages: Message[], text: string): {
    label: string
    confidence: number
    explanation?: string
  } {
    const toolMessages = messages.filter(m => m.role === 'tool')
    const lowerText = text.toLowerCase()

    if (toolMessages.length === 0) {
      return {
        label: 'discussion',
        confidence: 0.8,
        explanation: 'No tool calls detected'
      }
    }

    // 检查常见动作类型
    if (lowerText.includes('read') || lowerText.includes('view') || lowerText.includes('check')) {
      return {
        label: 'inspection',
        confidence: 0.7,
        explanation: 'Read/view operations detected'
      }
    }

    if (lowerText.includes('write') || lowerText.includes('edit') || lowerText.includes('create')) {
      return {
        label: 'modification',
        confidence: 0.7,
        explanation: 'Write/edit operations detected'
      }
    }

    if (lowerText.includes('test') || lowerText.includes('run') || lowerText.includes('execute')) {
      return {
        label: 'execution',
        confidence: 0.7,
        explanation: 'Test/execution operations detected'
      }
    }

    return {
      label: 'implementation',
      confidence: 0.6,
      explanation: 'General implementation task'
    }
  }

  private generateMemoryTags(
    classification: ClassificationResult,
    text: string
  ): Array<{ tag: string; confidence: number; source: 'rule' | 'llm' | 'memory' }> {
    const tags: Array<{ tag: string; confidence: number; source: 'rule' | 'llm' | 'memory' }> = []
    const lowerText = text.toLowerCase()

    // 从分类维度提取标签
    if (classification.dimensions.taskType) {
      tags.push({
        tag: classification.dimensions.taskType.label,
        confidence: classification.dimensions.taskType.confidence * 0.8,
        source: 'rule'
      })
    }

    if (classification.dimensions.complexity) {
      tags.push({
        tag: `complexity:${classification.dimensions.complexity.label}`,
        confidence: classification.dimensions.complexity.confidence * 0.7,
        source: 'rule'
      })
    }

    if (classification.dimensions.domain) {
      tags.push({
        tag: `domain:${classification.dimensions.domain.label}`,
        confidence: classification.dimensions.domain.confidence * 0.7,
        source: 'rule'
      })
    }

    // 添加基于关键词的标签
    const keywordTags = this.extractKeywordTags(lowerText)
    tags.push(...keywordTags)

    // 过滤低置信度标签
    return tags.filter(t => t.confidence >= this.config.memoryIntegration.tagQualityThreshold)
  }

  private extractKeywordTags(text: string): Array<{ tag: string; confidence: number; source: 'rule' | 'llm' | 'memory' }> {
    const tags: Array<{ tag: string; confidence: number; source: 'rule' }> = []
    const commonKeywords = [
      'bug', 'feature', 'refactor', 'test', 'documentation',
      'frontend', 'backend', 'api', 'database', 'ui',
      'urgent', 'important', 'critical', 'security'
    ]

    for (const keyword of commonKeywords) {
      if (text.includes(keyword)) {
        tags.push({
          tag: keyword,
          confidence: 0.6,
          source: 'rule'
        })
      }
    }

    return tags
  }

  private extractOverallTags(classification: ClassificationResult): string[] {
    const tags = new Set<string>()

    // 添加维度标签
    if (classification.dimensions.taskType) {
      tags.add(classification.dimensions.taskType.label)
    }

    if (classification.dimensions.complexity) {
      tags.add(`complexity:${classification.dimensions.complexity.label}`)
    }

    if (classification.dimensions.riskLevel) {
      tags.add(`risk:${classification.dimensions.riskLevel.label}`)
    }

    if (classification.dimensions.domain) {
      tags.add(`domain:${classification.dimensions.domain.label}`)
    }

    // 添加记忆标签
    for (const memoryTag of classification.memoryTags) {
      if (memoryTag.confidence >= 0.6) {
        tags.add(memoryTag.tag)
      }
    }

    return Array.from(tags)
  }

  private generateSuggestedStrategies(classification: ClassificationResult): string[] {
    const strategies: string[] = []

    // 基于任务类型
    if (classification.dimensions.taskType?.label === 'bug_fix') {
      strategies.push('先复现问题', '添加测试用例', '逐步调试')
    } else if (classification.dimensions.taskType?.label === 'feature') {
      strategies.push('设计API接口', '编写单元测试', '更新文档')
    } else if (classification.dimensions.taskType?.label === 'refactor') {
      strategies.push('确保测试覆盖', '小步重构', '验证功能不变')
    }

    // 基于复杂度
    if (classification.dimensions.complexity?.label === 'complex') {
      strategies.push('分解为子任务', '增加审查环节', '预留缓冲时间')
    }

    // 基于风险等级
    if (classification.dimensions.riskLevel?.label === 'high') {
      strategies.push('增加安全审查', '备份重要数据', '准备回滚方案')
    }

    // 默认策略
    if (strategies.length === 0) {
      strategies.push('明确需求', '小步验证', '及时沟通')
    }

    return strategies.slice(0, 3) // 最多返回3条策略
  }

  // ── LLM分类辅助方法 ──

  private prepareConversationForClassification(messages: Message[]): string {
    const recentMessages = messages.slice(-15) // 最近15条消息

    return recentMessages.map(m => {
      const role = m.role
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `[${role.toUpperCase()}]: ${content.slice(0, 300)}`
    }).join('/n/n')
  }

  private buildClassificationPrompt(
    conversationText: string,
    context: ClassificationContext
  ): string {
    const dimensions = Object.entries(this.config.dimensions)
      .filter(([_, enabled]) => enabled)
      .map(([dim]) => dim)
      .join(', ')

    return `Classify the following conversation along these dimensions: ${dimensions}.

Context:
- Session ID: ${context.sessionId}
- Task ID: ${context.taskId || 'N/A'}
- Query: ${context.query?.slice(0, 200) || 'N/A'}

For each enabled dimension, provide:
1. Label (appropriate categorical value)
2. Confidence score (0-1)
3. Brief explanation (optional)

Also provide:
- Memory tags (relevant keywords/tags)
- Overall tags (most relevant tags)
- Suggested strategies (actionable recommendations)

Conversation:
${conversationText}

Output as JSON with this structure:
{
  "dimensions": {
    "taskType": { "label": "...", "confidence": 0.95, "explanation": "..." },
    "complexity": { "label": "simple|moderate|complex", "confidence": 0.9, "explanation": "..." },
    "riskLevel": { "label": "low|medium|high", "confidence": 0.85, "explanation": "..." },
    "domain": { "label": "...", "confidence": 0.8, "explanation": "..." },
    "actionType": { "label": "...", "confidence": 0.75, "explanation": "..." }
  },
  "memoryTags": [
    { "tag": "...", "confidence": 0.9, "source": "llm" }
  ],
  "overallTags": ["tag1", "tag2"],
  "suggestedStrategies": ["strategy1", "strategy2"]
}`
  }

  private parseLLMClassificationResult(
    llmResult: any,
    messages: Message[],
    context: ClassificationContext
  ): ClassificationResult {
    const result = this.createEmptyResult(context)
    result.method = 'llm'

    // 解析维度
    if (llmResult.dimensions) {
      result.dimensions = {}

      if (this.config.dimensions.taskType && llmResult.dimensions.taskType) {
        result.dimensions.taskType = this.validateDimensionResult(llmResult.dimensions.taskType, 'taskType')
      }

      if (this.config.dimensions.complexity && llmResult.dimensions.complexity) {
        const validated = this.validateDimensionResult(llmResult.dimensions.complexity, 'complexity')
        if (['simple', 'moderate', 'complex'].includes(validated.label)) {
          result.dimensions.complexity = validated as any
        }
      }

      if (this.config.dimensions.riskLevel && llmResult.dimensions.riskLevel) {
        const validated = this.validateDimensionResult(llmResult.dimensions.riskLevel, 'riskLevel')
        if (['low', 'medium', 'high'].includes(validated.label)) {
          result.dimensions.riskLevel = validated as any
        }
      }

      if (this.config.dimensions.domain && llmResult.dimensions.domain) {
        result.dimensions.domain = this.validateDimensionResult(llmResult.dimensions.domain, 'domain')
      }

      if (this.config.dimensions.actionType && llmResult.dimensions.actionType) {
        result.dimensions.actionType = this.validateDimensionResult(llmResult.dimensions.actionType, 'actionType')
      }
    }

    // 解析记忆标签
    if (Array.isArray(llmResult.memoryTags)) {
      result.memoryTags = llmResult.memoryTags
        .filter((tag: any) => tag.tag && typeof tag.confidence === 'number')
        .map((tag: any) => ({
          tag: String(tag.tag),
          confidence: Math.max(0, Math.min(1, tag.confidence)),
          source: 'llm' as const
        }))
        .filter((tag: any) => tag.confidence >= this.config.llmClassification.minConfidence)
        .slice(0, this.config.llmClassification.maxClassifications)
    }

    // 解析总体标签
    if (Array.isArray(llmResult.overallTags)) {
      result.overallTags = llmResult.overallTags
        .filter((tag: any) => typeof tag === 'string')
        .slice(0, 10)
    }

    // 解析策略建议
    if (Array.isArray(llmResult.suggestedStrategies)) {
      result.suggestedStrategies = llmResult.suggestedStrategies
        .filter((strategy: any) => typeof strategy === 'string')
        .slice(0, 5)
    }

    return result
  }

  private validateDimensionResult(
    dimensionResult: any,
    dimensionName: string
  ): { label: string; confidence: number; explanation?: string } {
    const label = String(dimensionResult.label || 'unknown')
    let confidence = typeof dimensionResult.confidence === 'number'
      ? Math.max(0, Math.min(1, dimensionResult.confidence))
      : 0.5

    // 应用最小置信度阈值
    if (confidence < this.config.llmClassification.minConfidence) {
      confidence = this.config.llmClassification.minConfidence
    }

    const explanation = this.config.llmClassification.includeExplanations && dimensionResult.explanation
      ? String(dimensionResult.explanation)
      : undefined

    return { label, confidence, explanation }
  }

  // ── 通用辅助方法 ──

  private createEmptyResult(context: ClassificationContext): ClassificationResult {
    return {
      id: `classification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      sessionId: context.sessionId,
      taskId: context.taskId,
      dimensions: {},
      memoryTags: [],
      overallTags: [],
      suggestedStrategies: [],
      method: 'rule',
      metadata: {
        messageCount: 0,
        toolCallCount: 0,
        classificationTime: 0
      }
    }
  }

  private getAllText(messages: Message[]): string {
    return messages.map(m => {
      if (typeof m.content === 'string') {
        return m.content
      } else if (Array.isArray(m.content)) {
        return m.content.map(c => JSON.stringify(c)).join(' ')
      }
      return ''
    }).join(' ')
  }

  private mergeClassifications(
    ruleResult: ClassificationResult,
    llmResult: ClassificationResult
  ): ClassificationResult {
    const result = this.createEmptyResult({
      sessionId: ruleResult.sessionId,
      taskId: ruleResult.taskId
    })
    result.method = 'hybrid'

    // 合并维度：优先使用高置信度的结果
    result.dimensions = { ...ruleResult.dimensions }

    for (const [dimension, llmValue] of Object.entries(llmResult.dimensions)) {
      const ruleValue = (ruleResult.dimensions as any)[dimension]

      if (!ruleValue || (llmValue.confidence > ruleValue.confidence + 0.1)) {
        // LLM结果置信度更高，使用LLM结果
        (result.dimensions as any)[dimension] = llmValue
      }
      // 否则保持规则结果
    }

    // 合并标签：去重，优先使用高置信度
    const allTags = [...ruleResult.memoryTags, ...llmResult.memoryTags]
    const tagMap = new Map<string, { tag: string; confidence: number; source: 'rule' | 'llm' | 'memory' }>()

    for (const tag of allTags) {
      const existing = tagMap.get(tag.tag)
      if (!existing || tag.confidence > existing.confidence) {
        tagMap.set(tag.tag, tag)
      }
    }

    result.memoryTags = Array.from(tagMap.values())
      .filter(t => t.confidence >= this.config.memoryIntegration.tagQualityThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.llmClassification.maxClassifications)

    // 合并总体标签：去重
    result.overallTags = [...new Set([...ruleResult.overallTags, ...llmResult.overallTags])].slice(0, 10)

    // 合并策略建议：去重
    result.suggestedStrategies = [...new Set([...ruleResult.suggestedStrategies, ...llmResult.suggestedStrategies])].slice(0, 5)

    return result
  }

  // ── 公共方法 ──

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ClassifierConfig>): void {
    Object.assign(this.config, config)
    console.log(`[Classifier] Config updated`)
  }

  /**
   * 获取配置
   */
  getConfig(): ClassifierConfig {
    return { ...this.config }
  }
}

// ── 工厂函数 ──

/**
 * 创建Classifier实例
 */
export function createClassifier(config?: Partial<ClassifierConfig>): Classifier {
  return new Classifier(config)
}

/**
 * 创建默认配置的Classifier
 */
export function createDefaultClassifier(): Classifier {
  return createClassifier()
}
