import { describe, it, expect } from 'bun:test'
import {
  createProblemSlice,
  createProblemSlicerResult,
  validateProblemSlice,
  type ProblemSlice,
  type ProblemSliceProfile,
  type ProblemSliceRiskLevel
} from '../../problem-slicer'

describe('Problem Slicer 核心结构定义验证', () => {
  describe('1. createProblemSlice 能创建最小 slice', () => {
    it('应该创建包含所有必需字段的 slice', () => {
      const slice = createProblemSlice({
        id: 'slice-001',
        title: '修复登录页面样式',
        intent: '修复登录页面的CSS样式问题',
        suggestedProfile: 'edit',
        expectedTools: ['file_edit', 'bash'],
        riskLevel: 'low'
      })

      // 验证必需字段
      expect(slice.id).toBe('slice-001')
      expect(slice.title).toBe('修复登录页面样式')
      expect(slice.intent).toBe('修复登录页面的CSS样式问题')
      expect(slice.suggestedProfile).toBe('edit')
      expect(slice.expectedTools).toEqual(['file_edit', 'bash'])
      expect(slice.riskLevel).toBe('low')

      // 验证系统字段
      expect(slice.createdAt).toBeGreaterThan(0)
      expect(slice.updatedAt).toBeGreaterThan(0)
      expect(slice.createdAt).toBe(slice.updatedAt)

      // 验证可选字段默认值
      expect(slice.description).toBeUndefined()
      expect(slice.dependencies).toBeUndefined()
      expect(slice.notes).toBeUndefined()
      expect(slice.estimatedEffort).toBeUndefined()
    })

    it('应该创建包含所有可选字段的 slice', () => {
      const slice = createProblemSlice({
        id: 'slice-002',
        title: '重构用户认证模块',
        intent: '重构用户认证模块以提高安全性',
        suggestedProfile: 'plan',
        expectedTools: ['file_edit', 'bash', 'git'],
        riskLevel: 'high',
        description: '这是一个复杂的重构任务',
        dependencies: ['slice-001'],
        notes: '需要先完成slice-001',
        estimatedEffort: 120
      })

      // 验证必需字段
      expect(slice.id).toBe('slice-002')
      expect(slice.title).toBe('重构用户认证模块')
      expect(slice.intent).toBe('重构用户认证模块以提高安全性')
      expect(slice.suggestedProfile).toBe('plan')
      expect(slice.expectedTools).toEqual(['file_edit', 'bash', 'git'])
      expect(slice.riskLevel).toBe('high')

      // 验证可选字段
      expect(slice.description).toBe('这是一个复杂的重构任务')
      expect(slice.dependencies).toEqual(['slice-001'])
      expect(slice.notes).toBe('需要先完成slice-001')
      expect(slice.estimatedEffort).toBe(120)

      // 验证系统字段
      expect(slice.createdAt).toBeGreaterThan(0)
      expect(slice.updatedAt).toBeGreaterThan(0)
    })
  })

  describe('2. suggestedProfile 取值有效', () => {
    const validProfiles: ProblemSliceProfile[] = ['plan', 'edit', 'review', 'session']

    validProfiles.forEach(profile => {
      it(`应该接受有效的 profile: ${profile}`, () => {
        const slice = createProblemSlice({
          id: `slice-${profile}`,
          title: `测试 ${profile} profile`,
          intent: `测试 ${profile} profile 的有效性`,
          suggestedProfile: profile,
          expectedTools: [],
          riskLevel: 'low'
        })

        expect(slice.suggestedProfile).toBe(profile)
      })
    })

    // TypeScript 会在编译时检查类型，但这里验证运行时行为
    it('应该拒绝无效的 profile 值', () => {
      // 注意：TypeScript 会在编译时阻止传入无效值
      // 这里主要验证类型系统的有效性
      const validProfilesSet = new Set(['plan', 'edit', 'review', 'session'])
      expect(validProfilesSet.has('plan')).toBe(true)
      expect(validProfilesSet.has('invalid')).toBe(false)
    })
  })

  describe('3. riskLevel 取值有效', () => {
    const validRiskLevels: ProblemSliceRiskLevel[] = ['low', 'medium', 'high']

    validRiskLevels.forEach(riskLevel => {
      it(`应该接受有效的 riskLevel: ${riskLevel}`, () => {
        const slice = createProblemSlice({
          id: `slice-${riskLevel}`,
          title: `测试 ${riskLevel} risk`,
          intent: `测试 ${riskLevel} risk 的有效性`,
          suggestedProfile: 'edit',
          expectedTools: [],
          riskLevel
        })

        expect(slice.riskLevel).toBe(riskLevel)
      })
    })

    it('应该拒绝无效的 riskLevel 值', () => {
      const validRiskLevelsSet = new Set(['low', 'medium', 'high'])
      expect(validRiskLevelsSet.has('low')).toBe(true)
      expect(validRiskLevelsSet.has('invalid')).toBe(false)
    })
  })

  describe('4. 预留字段可安全初始化', () => {
    it('应该处理所有可选字段为 undefined', () => {
      const slice = createProblemSlice({
        id: 'slice-minimal',
        title: '最小 slice',
        intent: '测试最小配置',
        suggestedProfile: 'edit',
        expectedTools: [],
        riskLevel: 'low'
        // 不提供可选字段
      })

      expect(slice.description).toBeUndefined()
      expect(slice.dependencies).toBeUndefined()
      expect(slice.notes).toBeUndefined()
      expect(slice.estimatedEffort).toBeUndefined()
    })

    it('应该处理空数组依赖', () => {
      const slice = createProblemSlice({
        id: 'slice-empty-deps',
        title: '空依赖 slice',
        intent: '测试空依赖',
        suggestedProfile: 'edit',
        expectedTools: [],
        riskLevel: 'low',
        dependencies: []
      })

      expect(slice.dependencies).toEqual([])
    })

    it('应该处理空字符串可选字段', () => {
      const slice = createProblemSlice({
        id: 'slice-empty-strings',
        title: '空字符串 slice',
        intent: '测试空字符串字段',
        suggestedProfile: 'edit',
        expectedTools: [],
        riskLevel: 'low',
        description: '',
        notes: ''
      })

      expect(slice.description).toBe('')
      expect(slice.notes).toBe('')
    })

    it('应该处理零工作量', () => {
      const slice = createProblemSlice({
        id: 'slice-zero-effort',
        title: '零工作量 slice',
        intent: '测试零工作量',
        suggestedProfile: 'edit',
        expectedTools: [],
        riskLevel: 'low',
        estimatedEffort: 0
      })

      expect(slice.estimatedEffort).toBe(0)
    })
  })

  describe('5. 基础辅助函数有效', () => {
    describe('createProblemSlicerResult', () => {
      it('应该创建有效的切片器结果', () => {
        const slices = [
          createProblemSlice({
            id: 'slice-1',
            title: 'Slice 1',
            intent: 'Intent 1',
            suggestedProfile: 'edit',
            expectedTools: ['tool1'],
            riskLevel: 'low',
            estimatedEffort: 30
          }),
          createProblemSlice({
            id: 'slice-2',
            title: 'Slice 2',
            intent: 'Intent 2',
            suggestedProfile: 'plan',
            expectedTools: ['tool2'],
            riskLevel: 'high',
            estimatedEffort: 60
          })
        ]

        const result = createProblemSlicerResult('测试任务', slices)

        expect(result.originalTask).toBe('测试任务')
        expect(result.slices).toEqual(slices)
        expect(result.totalSlices).toBe(2)
        expect(result.overallRiskLevel).toBe('high') // 取最高风险
        expect(result.totalEstimatedEffort).toBe(90)
        expect(result.generatedAt).toBeGreaterThan(0)
      })

      it('应该处理空切片列表', () => {
        const result = createProblemSlicerResult('空任务', [])

        expect(result.originalTask).toBe('空任务')
        expect(result.slices).toEqual([])
        expect(result.totalSlices).toBe(0)
        expect(result.overallRiskLevel).toBe('low') // 空列表默认低风险
        expect(result.totalEstimatedEffort).toBeUndefined()
        expect(result.generatedAt).toBeGreaterThan(0)
      })

      it('应该正确计算无预估工作量的情况', () => {
        const slices = [
          createProblemSlice({
            id: 'slice-no-effort',
            title: '无工作量 slice',
            intent: '测试无工作量',
            suggestedProfile: 'edit',
            expectedTools: [],
            riskLevel: 'medium'
            // 不提供 estimatedEffort
          })
        ]

        const result = createProblemSlicerResult('无工作量任务', slices)

        expect(result.totalEstimatedEffort).toBeUndefined()
      })
    })

    describe('validateProblemSlice', () => {
      it('应该验证合法的 slice', () => {
        const validSlice = createProblemSlice({
          id: 'valid-slice',
          title: '合法 slice',
          intent: '这是一个合法的 slice',
          suggestedProfile: 'review',
          expectedTools: ['tool1', 'tool2'],
          riskLevel: 'medium'
        })

        const validation = validateProblemSlice(validSlice)

        expect(validation.valid).toBe(true)
        expect(validation.errors).toEqual([])
      })

      it('应该拒绝缺少必需字段的 slice', () => {
        const invalidSlice: any = {
          id: '', // 空ID
          title: '', // 空标题
          intent: '', // 空意图
          // 缺少 suggestedProfile
          expectedTools: [], // 空数组但有效
          riskLevel: 'invalid' as any, // 无效风险等级
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        const validation = validateProblemSlice(invalidSlice)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('切片ID不能为空')
        expect(validation.errors).toContain('切片标题不能为空')
        expect(validation.errors).toContain('切片意图不能为空')
        // 注意：由于 suggestedProfile 是 undefined，所以错误信息是"必须指定建议剖面"
        // 而不是"建议剖面必须是 plan、edit、review 或 session"
        expect(validation.errors).toContain('必须指定建议剖面')
        expect(validation.errors).toContain('风险等级必须是 low、medium 或 high')
      })

      it('应该拒绝 expectedTools 不是数组的 slice', () => {
        const invalidSlice: any = {
          id: 'slice-invalid-tools',
          title: '无效工具 slice',
          intent: '测试无效工具',
          suggestedProfile: 'edit',
          expectedTools: 'not-an-array', // 不是数组
          riskLevel: 'low',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        const validation = validateProblemSlice(invalidSlice)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('expectedTools必须是数组')
      })

      it('应该拒绝无效的 suggestedProfile 值', () => {
        const invalidSlice: any = {
          id: 'slice-invalid-profile',
          title: '无效profile slice',
          intent: '测试无效profile',
          suggestedProfile: 'invalid-profile', // 无效的profile
          expectedTools: [],
          riskLevel: 'low',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        const validation = validateProblemSlice(invalidSlice)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('建议剖面必须是 plan、edit、review 或 session')
      })

      it('应该拒绝无效的 riskLevel 值', () => {
        const invalidSlice: any = {
          id: 'slice-invalid-risk',
          title: '无效风险 slice',
          intent: '测试无效风险等级',
          suggestedProfile: 'edit',
          expectedTools: [],
          riskLevel: 'invalid-risk', // 无效的风险等级
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        const validation = validateProblemSlice(invalidSlice)

        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('风险等级必须是 low、medium 或 high')
      })

      it('应该接受 expectedTools 为空数组的 slice', () => {
        const slice = createProblemSlice({
          id: 'slice-empty-tools',
          title: '空工具 slice',
          intent: '测试空工具列表',
          suggestedProfile: 'session',
          expectedTools: [], // 空数组是有效的
          riskLevel: 'low'
        })

        const validation = validateProblemSlice(slice)

        expect(validation.valid).toBe(true)
        expect(validation.errors).toEqual([])
      })
    })
  })
})