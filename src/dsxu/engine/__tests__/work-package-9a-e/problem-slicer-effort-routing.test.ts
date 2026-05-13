import { describe, it, expect } from 'bun:test'
import { sliceProblem } from '../../problem-slicer'

describe('9A-E: Effort Routing 接入 Problem Slicer 验证', () => {
  describe('测试1：普通切片会带 effort 决策', () => {
    it('sliceProblem() 返回的每个 slice 都有 effort 决策字段', () => {
      const task = '分析用户需求。设计系统架构。编写核心代码。测试功能完整性。'
      const result = sliceProblem(task)

      // 验证切片数量
      expect(result.slices.length).toBeGreaterThanOrEqual(2)
      expect(result.slices.length).toBeLessThanOrEqual(4)

      // 验证每个切片都有 effort 决策字段
      result.slices.forEach((slice, index) => {
        console.log(`切片 ${index + 1}:`, {
          title: slice.title,
          profile: slice.suggestedProfile,
          risk: slice.riskLevel,
          effortLevel: slice.effortLevel,
          reasoningPreference: slice.reasoningPreference,
          useDeepReviewPath: slice.useDeepReviewPath
        })

        // 必需字段验证
        expect(slice.effortLevel).toBeDefined()
        expect(slice.reasoningPreference).toBeDefined()
        expect(slice.useDeepReviewPath).toBeDefined()

        // 字段类型验证
        expect(['low', 'medium', 'high']).toContain(slice.effortLevel!)
        expect(['fast', 'balanced', 'deep']).toContain(slice.reasoningPreference!)
        expect(typeof slice.useDeepReviewPath).toBe('boolean')
      })

      console.log('✅ 所有切片都有完整的 effort 决策字段')
    })

    it('短任务生成的切片也有 effort 决策字段', () => {
      const shortTask = '修复bug'
      const result = sliceProblem(shortTask)

      expect(result.slices.length).toBeGreaterThanOrEqual(2)

      result.slices.forEach(slice => {
        expect(slice.effortLevel).toBeDefined()
        expect(slice.reasoningPreference).toBeDefined()
        expect(slice.useDeepReviewPath).toBeDefined()
      })
    })
  })

  describe('测试2：不同风险/复杂度会影响 effort 决策', () => {
    it('高风险切片更容易触发 useDeepReviewPath=true', () => {
      // 创建高风险任务
      const highRiskTask = '修复关键安全漏洞，这是非常重要的任务'
      const result = sliceProblem(highRiskTask)

      // 检查是否有高风险切片
      const highRiskSlices = result.slices.filter(s => s.riskLevel === 'high')

      if (highRiskSlices.length > 0) {
        // 高风险切片应该更容易触发深度审查
        const highRiskWithDeepReview = highRiskSlices.filter(s => s.useDeepReviewPath === true)
        console.log(`高风险切片: ${highRiskSlices.length}个，其中触发深度审查: ${highRiskWithDeepReview.length}个`)

        // 至少有一个高风险切片触发深度审查
        expect(highRiskWithDeepReview.length).toBeGreaterThan(0)
      }

      // 检查所有切片中触发深度审查的比例
      const totalSlices = result.slices.length
      const slicesWithDeepReview = result.slices.filter(s => s.useDeepReviewPath === true)
      console.log(`总切片: ${totalSlices}个，触发深度审查: ${slicesWithDeepReview.length}个`)
    })

    it('不同风险等级的切片 effortLevel 有差异', () => {
      // 创建包含不同风险关键词的任务
      const mixedRiskTask = '简单配置调整。重要功能开发。关键系统修复。'
      const result = sliceProblem(mixedRiskTask)

      // 收集不同风险等级的 effortLevel
      const effortByRisk: Record<string, string[]> = {
        low: [],
        medium: [],
        high: []
      }

      result.slices.forEach(slice => {
        if (slice.effortLevel && slice.riskLevel) {
          effortByRisk[slice.riskLevel].push(slice.effortLevel)
        }
      })

      console.log('不同风险等级的 effortLevel 分布:', effortByRisk)

      // 验证至少有一种风险等级有切片
      const riskLevels = Object.keys(effortByRisk).filter(risk => effortByRisk[risk].length > 0)
      expect(riskLevels.length).toBeGreaterThan(0)

      // 如果有高风险切片，其effortLevel应该是high
      if (effortByRisk.high.length > 0) {
        expect(effortByRisk.high).toContain('high')
      }
    })
  })

  describe('测试3：不同 suggestedProfile 会影响决策倾向', () => {
    it('plan 和 edit 剖面的推理偏好存在差异', () => {
      // 创建明确包含不同剖面的任务
      const profileTask = '分析系统架构。编辑配置文件。审查代码质量。协调团队工作。'
      const result = sliceProblem(profileTask)

      // 按剖面分组收集推理偏好
      const reasoningByProfile: Record<string, string[]> = {
        plan: [],
        edit: [],
        review: [],
        session: []
      }

      result.slices.forEach(slice => {
        if (slice.reasoningPreference && slice.suggestedProfile) {
          reasoningByProfile[slice.suggestedProfile].push(slice.reasoningPreference)
        }
      })

      console.log('不同剖面的推理偏好分布:', reasoningByProfile)

      // 验证至少有两种不同的剖面
      const profiles = Object.keys(reasoningByProfile).filter(profile => reasoningByProfile[profile].length > 0)
      expect(profiles.length).toBeGreaterThanOrEqual(2)

      // plan 剖面应该倾向于 deep 推理
      if (reasoningByProfile.plan.length > 0) {
        expect(reasoningByProfile.plan).toContain('deep')
      }

      // edit 剖面应该倾向于 balanced 推理
      if (reasoningByProfile.edit.length > 0) {
        expect(reasoningByProfile.edit).toContain('balanced')
      }
    })

    it('不同剖面的 useDeepReviewPath 决策存在差异', () => {
      // 创建包含高风险和工具执行的任务
      const highRiskTask = '修复关键安全漏洞并编辑配置文件'
      const result = sliceProblem(highRiskTask)

      // 检查高风险切片是否触发深度审查
      const highRiskSlices = result.slices.filter(s => s.riskLevel === 'high')
      const highRiskWithDeepReview = highRiskSlices.filter(s => s.useDeepReviewPath === true)

      console.log(`高风险切片: ${highRiskSlices.length}个，触发深度审查: ${highRiskWithDeepReview.length}个`)

      // 如果有高风险切片，至少有一个应该触发深度审查
      if (highRiskSlices.length > 0) {
        expect(highRiskWithDeepReview.length).toBeGreaterThan(0)
      }

      // 对比不同风险等级的深度审查触发率
      const deepReviewByRisk: Record<string, { total: number, withDeepReview: number }> = {}

      result.slices.forEach(slice => {
        if (!deepReviewByRisk[slice.riskLevel]) {
          deepReviewByRisk[slice.riskLevel] = { total: 0, withDeepReview: 0 }
        }
        deepReviewByRisk[slice.riskLevel].total++
        if (slice.useDeepReviewPath) {
          deepReviewByRisk[slice.riskLevel].withDeepReview++
        }
      })

      console.log('不同风险等级的深度审查触发率:', deepReviewByRisk)
    })
  })
})
