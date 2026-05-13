import { describe, it, expect } from 'bun:test'
import {
  createCheckRule,
  createCheckRuleCondition,
  createCheckRuleAction,
  createCheckRuleResult,
  createCheckRuleResultSet,
  createSyntaxCheckRule,
  createDangerousChangeCheckRule,
  createVerificationCheckRule,
  type CheckRule,
  type CheckRuleCategory,
  type CheckRuleSeverity,
  type CheckRulePhase,
  type CheckRuleCondition,
  type CheckRuleAction,
  type CheckRuleResult,
  type CheckRuleResultSet
} from '../../checks-as-rules'

describe('9A-C: Checks as Rules 核心结构定义验证', () => {
  describe('1. createCheckRule 能创建最小 rule', () => {
    it('应该创建包含所有必需字段的最小 rule', () => {
      const condition = createCheckRuleCondition({
        type: 'simple',
        expression: 'file_path.contains("test")',
        description: '检查文件路径是否包含 test'
      })

      const action = createCheckRuleAction({
        type: 'warn',
        message: '检测到测试文件',
        details: '文件路径包含 test 关键字',
        fixSuggestion: '考虑重命名文件'
      })

      const rule = createCheckRule({
        id: 'test-rule-001',
        name: '测试规则',
        category: 'verification',
        severity: 'medium',
        description: '这是一个测试规则',
        condition,
        action,
        enabled: true,
        appliesToPhase: ['verify', 'review'],
        tags: ['test', 'validation']
      })

      // 验证必需字段存在
      expect(rule.id).toBe('test-rule-001')
      expect(rule.name).toBe('测试规则')
      expect(rule.category).toBe('verification')
      expect(rule.severity).toBe('medium')
      expect(rule.description).toBe('这是一个测试规则')
      expect(rule.condition).toBe(condition)
      expect(rule.action).toBe(action)
      expect(rule.enabled).toBe(true)
      expect(rule.appliesToPhase).toEqual(['verify', 'review'])
      expect(rule.tags).toEqual(['test', 'validation'])

      // 验证 metadata 自动生成
      expect(rule.metadata).toBeDefined()
      expect(rule.metadata?.createdAt).toBeGreaterThan(0)
      expect(rule.metadata?.updatedAt).toBeGreaterThan(0)

      console.log('创建的最小 rule:', {
        id: rule.id,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        enabled: rule.enabled,
        phases: rule.appliesToPhase,
        tags: rule.tags
      })
    })

    it('应该使用默认值创建 rule', () => {
      const condition = createCheckRuleCondition({
        type: 'regex',
        expression: '.*\\.ts$'
      })

      const action = createCheckRuleAction({
        type: 'error',
        message: 'TypeScript 文件检查'
      })

      const rule = createCheckRule({
        id: 'default-rule-001',
        name: '默认规则',
        category: 'syntax',
        severity: 'high',
        description: '默认规则测试',
        condition,
        action
        // 不传 enabled, appliesToPhase, tags
      })

      // 验证默认值
      expect(rule.enabled).toBe(true)
      expect(rule.appliesToPhase).toEqual(['verify', 'review'])
      expect(rule.tags).toEqual([])
      expect(rule.metadata).toBeDefined()

      console.log('使用默认值创建的 rule:', {
        enabled: rule.enabled,
        appliesToPhase: rule.appliesToPhase,
        tags: rule.tags
      })
    })
  })

  describe('2. rule category / severity / phase 取值有效', () => {
    it('category 至少支持 syntax, dangerous_change, verification', () => {
      const testCategories: CheckRuleCategory[] = ['syntax', 'dangerous_change', 'verification']

      testCategories.forEach(category => {
        const condition = createCheckRuleCondition({
          type: 'simple',
          expression: 'true'
        })

        const action = createCheckRuleAction({
          type: 'warn',
          message: '测试消息'
        })

        const rule = createCheckRule({
          id: `category-test-${category}`,
          name: `分类测试: ${category}`,
          category,
          severity: 'medium',
          description: '分类测试',
          condition,
          action
        })

        expect(rule.category).toBe(category)
        expect(testCategories).toContain(rule.category)
      })

      console.log('支持的 category 值:', ['syntax', 'dangerous_change', 'verification'])
    })

    it('severity 至少支持 low, medium, high', () => {
      const testSeverities: CheckRuleSeverity[] = ['low', 'medium', 'high']

      testSeverities.forEach(severity => {
        const condition = createCheckRuleCondition({
          type: 'simple',
          expression: 'true'
        })

        const action = createCheckRuleAction({
          type: 'warn',
          message: '测试消息'
        })

        const rule = createCheckRule({
          id: `severity-test-${severity}`,
          name: `严重程度测试: ${severity}`,
          category: 'verification',
          severity,
          description: '严重程度测试',
          condition,
          action
        })

        expect(rule.severity).toBe(severity)
        expect(testSeverities).toContain(rule.severity)
      })

      console.log('支持的 severity 值:', ['low', 'medium', 'high'])
    })

    it('appliesToPhase 至少支持 verify, review', () => {
      const testPhases: CheckRulePhase[] = ['verify', 'review']

      // 测试单个阶段
      testPhases.forEach(phase => {
        const condition = createCheckRuleCondition({
          type: 'simple',
          expression: 'true'
        })

        const action = createCheckRuleAction({
          type: 'warn',
          message: '测试消息'
        })

        const rule = createCheckRule({
          id: `phase-test-${phase}`,
          name: `阶段测试: ${phase}`,
          category: 'verification',
          severity: 'medium',
          description: '阶段测试',
          condition,
          action,
          appliesToPhase: [phase]
        })

        expect(rule.appliesToPhase).toEqual([phase])
        expect(rule.appliesToPhase[0]).toBe(phase)
      })

      // 测试多个阶段
      const condition = createCheckRuleCondition({
        type: 'simple',
        expression: 'true'
      })

      const action = createCheckRuleAction({
        type: 'warn',
        message: '测试消息'
      })

      const multiPhaseRule = createCheckRule({
        id: 'multi-phase-test',
        name: '多阶段测试',
        category: 'verification',
        severity: 'medium',
        description: '多阶段测试',
        condition,
        action,
        appliesToPhase: ['verify', 'review']
      })

      expect(multiPhaseRule.appliesToPhase).toContain('verify')
      expect(multiPhaseRule.appliesToPhase).toContain('review')
      expect(multiPhaseRule.appliesToPhase.length).toBe(2)

      console.log('支持的 phase 值:', ['verify', 'review'])
    })
  })

  describe('3. rule result 结构有效', () => {
    it('createCheckRuleResult() 应该返回完整的结果结构', () => {
      const result = createCheckRuleResult({
        id: 'result-001',
        ruleId: 'rule-001',
        status: 'failed',
        target: 'src/app.ts',
        details: '语法检查失败',
        errorMessage: '缺少分号',
        fixSuggestion: '在第42行添加分号',
        context: { line: 42, column: 10 },
        metadata: {
          executionTime: 150,
          resourceUsage: { memory: '50MB' }
        }
      })

      // 验证必需字段
      expect(result.id).toBe('result-001')
      expect(result.ruleId).toBe('rule-001')
      expect(result.status).toBe('failed')
      expect(result.checkedAt).toBeGreaterThan(0)
      expect(result.target).toBe('src/app.ts')

      // 验证可选字段
      expect(result.details).toBe('语法检查失败')
      expect(result.errorMessage).toBe('缺少分号')
      expect(result.fixSuggestion).toBe('在第42行添加分号')
      expect(result.context).toEqual({ line: 42, column: 10 })
      expect(result.metadata?.executionTime).toBe(150)
      expect(result.metadata?.resourceUsage).toEqual({ memory: '50MB' })

      console.log('创建的 rule result:', {
        id: result.id,
        ruleId: result.ruleId,
        status: result.status,
        target: result.target,
        hasDetails: !!result.details,
        hasFixSuggestion: !!result.fixSuggestion
      })
    })

    it('可选字段可安全存在或缺省', () => {
      // 测试最小结果（只有必需字段）
      const minimalResult = createCheckRuleResult({
        id: 'minimal-result',
        ruleId: 'minimal-rule',
        status: 'passed',
        target: 'src/test.ts'
      })

      expect(minimalResult.id).toBe('minimal-result')
      expect(minimalResult.ruleId).toBe('minimal-rule')
      expect(minimalResult.status).toBe('passed')
      expect(minimalResult.target).toBe('src/test.ts')
      expect(minimalResult.details).toBeUndefined()
      expect(minimalResult.errorMessage).toBeUndefined()
      expect(minimalResult.fixSuggestion).toBeUndefined()
      expect(minimalResult.context).toBeUndefined()
      expect(minimalResult.metadata).toBeUndefined()

      // 测试不同状态的结果
      const statuses: Array<CheckRuleResult['status']> = ['passed', 'failed', 'warning', 'skipped', 'error']
      statuses.forEach(status => {
        const result = createCheckRuleResult({
          id: `status-test-${status}`,
          ruleId: 'test-rule',
          status,
          target: 'src/file.ts'
        })
        expect(result.status).toBe(status)
      })

      console.log('可选字段测试: 最小结果和不同状态结果都有效')
    })
  })

  describe('4. 辅助创建函数有效', () => {
    it('createCheckRuleCondition() 应该创建完整的条件结构', () => {
      const condition = createCheckRuleCondition({
        type: 'regex',
        expression: '.*\\.test\\.ts$',
        description: '匹配测试文件',
        params: { caseSensitive: false }
      })

      expect(condition.type).toBe('regex')
      expect(condition.expression).toBe('.*\\.test\\.ts$')
      expect(condition.description).toBe('匹配测试文件')
      expect(condition.params).toEqual({ caseSensitive: false })

      // 验证可放入 rule 中
      const rule = createCheckRule({
        id: 'condition-test',
        name: '条件测试',
        category: 'verification',
        severity: 'medium',
        description: '测试条件结构',
        condition,
        action: createCheckRuleAction({
          type: 'warn',
          message: '测试'
        })
      })

      expect(rule.condition).toBe(condition)
    })

    it('createCheckRuleAction() 应该创建完整的动作结构', () => {
      const action = createCheckRuleAction({
        type: 'auto_fix',
        message: '自动修复建议',
        details: '检测到可自动修复的问题',
        fixSuggestion: '运行 npm run fix',
        params: { autoApply: true }
      })

      expect(action.type).toBe('auto_fix')
      expect(action.message).toBe('自动修复建议')
      expect(action.details).toBe('检测到可自动修复的问题')
      expect(action.fixSuggestion).toBe('运行 npm run fix')
      expect(action.params).toEqual({ autoApply: true })

      // 验证可放入 rule 中
      const rule = createCheckRule({
        id: 'action-test',
        name: '动作测试',
        category: 'verification',
        severity: 'medium',
        description: '测试动作结构',
        condition: createCheckRuleCondition({
          type: 'simple',
          expression: 'true'
        }),
        action
      })

      expect(rule.action).toBe(action)
    })

    it('createCheckRuleResultSet() 应该创建完整的结果集结构', () => {
      // 创建一些测试结果
      const results: CheckRuleResult[] = [
        createCheckRuleResult({
          id: 'result-1',
          ruleId: 'rule-1',
          status: 'passed',
          target: 'src/file1.ts'
        }),
        createCheckRuleResult({
          id: 'result-2',
          ruleId: 'rule-2',
          status: 'failed',
          target: 'src/file2.ts',
          errorMessage: '编译错误'
        }),
        createCheckRuleResult({
          id: 'result-3',
          ruleId: 'rule-3',
          status: 'warning',
          target: 'src/file3.ts',
          details: '代码风格警告'
        })
      ]

      const resultSet = createCheckRuleResultSet({
        id: 'result-set-001',
        phase: 'verify',
        results,
        taskId: 'task-001',
        metadata: { environment: 'test' }
      })

      // 验证必需字段
      expect(resultSet.id).toBe('result-set-001')
      expect(resultSet.phase).toBe('verify')
      expect(resultSet.results).toBe(results)
      expect(resultSet.taskId).toBe('task-001')
      expect(resultSet.startedAt).toBeGreaterThan(0)
      expect(resultSet.completedAt).toBeGreaterThan(0)
      expect(resultSet.metadata).toEqual({ environment: 'test' })

      // 验证统计信息
      expect(resultSet.stats.totalRules).toBe(3)
      expect(resultSet.stats.passed).toBe(1)
      expect(resultSet.stats.failed).toBe(1)
      expect(resultSet.stats.warnings).toBe(1)
      expect(resultSet.stats.skipped).toBe(0)
      expect(resultSet.stats.errors).toBe(0)

      console.log('创建的结果集统计:', resultSet.stats)
    })
  })

  describe('5. 示例规则函数有效', () => {
    it('createSyntaxCheckRule() 应该返回合法的语法检查规则', () => {
      const rule = createSyntaxCheckRule()

      // 验证规则结构合法
      expect(rule.id).toBe('syntax-check-001')
      expect(rule.name).toBe('TypeScript 语法检查')
      expect(rule.category).toBe('syntax')
      expect(rule.severity).toBe('high')
      expect(rule.description).toContain('TypeScript')
      expect(rule.enabled).toBe(true)

      // 验证 category / severity / appliesToPhase 合理
      expect(['syntax', 'dangerous_change', 'verification']).toContain(rule.category)
      expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity)
      expect(rule.appliesToPhase).toContain('verify')
      expect(rule.appliesToPhase).toContain('review')

      // 验证条件结构
      expect(rule.condition.type).toBe('simple')
      expect(rule.condition.expression).toContain('.ts')
      expect(rule.condition.description).toContain('TypeScript')

      // 验证动作结构
      expect(rule.action.type).toBe('error')
      expect(rule.action.message).toContain('TypeScript')
      expect(rule.action.fixSuggestion).toContain('tsc')

      console.log('语法检查规则:', {
        category: rule.category,
        severity: rule.severity,
        phases: rule.appliesToPhase,
        tags: rule.tags
      })
    })

    it('createDangerousChangeCheckRule() 应该返回合法的危险变更检查规则', () => {
      const rule = createDangerousChangeCheckRule()

      // 验证规则结构合法
      expect(rule.id).toBe('dangerous-change-001')
      expect(rule.name).toBe('危险文件修改检查')
      expect(rule.category).toBe('dangerous_change')
      expect(rule.severity).toBe('critical')
      expect(rule.description).toContain('关键系统文件')
      expect(rule.enabled).toBe(true)

      // 验证 category / severity / appliesToPhase 合理
      expect(['syntax', 'dangerous_change', 'verification']).toContain(rule.category)
      expect(rule.severity).toBe('critical')
      expect(rule.appliesToPhase).toEqual(['review'])

      // 验证条件结构
      expect(rule.condition.type).toBe('regex')
      expect(rule.condition.expression).toContain('package\\.json')
      expect(rule.condition.description).toContain('关键配置文件')

      // 验证动作结构
      expect(rule.action.type).toBe('require_approval')
      expect(rule.action.message).toContain('关键文件修改')
      expect(rule.action.details).toContain('package.json')

      console.log('危险变更检查规则:', {
        category: rule.category,
        severity: rule.severity,
        phases: rule.appliesToPhase,
        tags: rule.tags
      })
    })

    it('createVerificationCheckRule() 应该返回合法的验证规则', () => {
      const rule = createVerificationCheckRule()

      // 验证规则结构合法
      expect(rule.id).toBe('verification-001')
      expect(rule.name).toBe('单元测试覆盖率检查')
      expect(rule.category).toBe('verification')
      expect(rule.severity).toBe('medium')
      expect(rule.description).toContain('单元测试')
      expect(rule.enabled).toBe(true)

      // 验证 category / severity / appliesToPhase 合理
      expect(['syntax', 'dangerous_change', 'verification']).toContain(rule.category)
      expect(rule.severity).toBe('medium')
      expect(rule.appliesToPhase).toEqual(['verify'])

      // 验证条件结构
      expect(rule.condition.type).toBe('custom')
      expect(rule.condition.expression).toBe('has_test_coverage')
      expect(rule.condition.description).toContain('测试覆盖率')

      // 验证动作结构
      expect(rule.action.type).toBe('warn')
      expect(rule.action.message).toContain('测试覆盖率')
      expect(rule.action.fixSuggestion).toContain('单元测试')

      console.log('验证规则:', {
        category: rule.category,
        severity: rule.severity,
        phases: rule.appliesToPhase,
        tags: rule.tags
      })
    })
  })
})
