/**
 * Harness Integration Tests
 *
 * 测试3个harness文件的集成功能
 */

import { CompactMultilevelHarness } from '../harness/compact-multilevel-v1-harness'
import { SessionMemoryMainlineHarness } from '../harness/session-memory-mainline-v1-harness'
import { ContextHygieneHarness } from '../harness/context-hygiene-v1-harness'

describe('Harness Integration Tests', () => {
  describe('Compact Multilevel V1 Harness', () => {
    test('应正确测试多级压缩功能', () => {
      const result = CompactMultilevelHarness.testCompactMultilevel()
      expect(result.totalTests).toBe(2)
      expect(result.allPassed).toBe(true)
      expect(result.results).toHaveLength(2)
    })

    test('应正确测试上下文卫生功能', () => {
      const result = CompactMultilevelHarness.testContextHygiene()
      expect(result.totalTests).toBe(2)
      expect(result.allPassed).toBe(true)
      expect(result.results).toHaveLength(2)
    })

    test('应验证压缩级别支持', () => {
      const result = CompactMultilevelHarness.testCompactLevels()
      expect(result.levelsSupported).toBe(true)
      expect(result.actionsSupported).toBe(true)
      expect(result.structuredOutputSupported).toBe(true)
    })
  })

  describe('Session Memory Mainline V1 Harness', () => {
    test('应正确测试会话记忆主链功能', () => {
      const result = SessionMemoryMainlineHarness.testSessionMemoryMainline()
      expect(result.allValid).toBe(true)
      expect(result.validations.sessionSnapshotValid).toBe(true)
      expect(result.validations.sessionSummaryValid).toBe(true)
      expect(result.validations.extractedMemoriesValid).toBe(true)
    })

    test('应验证记忆分类支持', () => {
      const result = SessionMemoryMainlineHarness.testMemoryCategories()
      expect(result.meetsRequirement).toBe(true)
      expect(result.totalCategories).toBeGreaterThanOrEqual(5)
      expect(result.structuredOutputSupported).toBe(true)
    })

    test('应验证主链消费能力', () => {
      const result = SessionMemoryMainlineHarness.testMainlineConsumption()
      expect(result.consumptionReady).toBe(true)
      expect(result.mainlineDataValid).toBe(true)
      expect(result.canAccessSession).toBe(true)
      expect(result.canAccessMemory).toBe(true)
    })
  })

  describe('Context Hygiene V1 Harness', () => {
    test('应正确测试上下文卫生功能', () => {
      const result = ContextHygieneHarness.testContextHygiene()
      expect(result.allValid).toBe(true)
      expect(result.validations.expectedIssueTypesValid).toBe(true)
      expect(result.validations.validActionsValid).toBe(true)
      expect(result.validations.sampleIssuesValid).toBe(true)
    })

    test('应验证上下文卫生风险识别', () => {
      const result = ContextHygieneHarness.testContextHygieneRiskRecognition()
      expect(result.riskLevelsSupported).toBe(true)
      expect(result.severityLevelsSupported).toBe(true)
      expect(result.structuredRiskOutput).toBe(true)
    })

    test('应验证上下文卫生与压缩的集成', () => {
      const result = ContextHygieneHarness.testHygieneCompactIntegration()
      expect(result.meetsRequirement).toBe(true)
      expect(result.totalScenarios).toBeGreaterThanOrEqual(3)
      expect(result.integrationSupported).toBe(true)
    })
  })

  describe('Harness 集成验证', () => {
    test('所有3个harness应能同时工作', () => {
      // 测试所有harness同时工作
      const compactResult = CompactMultilevelHarness.testCompactMultilevel()
      const sessionResult = SessionMemoryMainlineHarness.testSessionMemoryMainline()
      const hygieneResult = ContextHygieneHarness.testContextHygiene()

      expect(compactResult.allPassed).toBe(true)
      expect(sessionResult.allValid).toBe(true)
      expect(hygieneResult.allValid).toBe(true)
    })

    test('harness应提供结构化输出', () => {
      const compactLevels = CompactMultilevelHarness.testCompactLevels()
      const memoryCategories = SessionMemoryMainlineHarness.testMemoryCategories()
      const riskRecognition = ContextHygieneHarness.testContextHygieneRiskRecognition()

      expect(compactLevels.structuredOutputSupported).toBe(true)
      expect(memoryCategories.structuredOutputSupported).toBe(true)
      expect(riskRecognition.structuredRiskOutput).toBe(true)
    })
  })
})