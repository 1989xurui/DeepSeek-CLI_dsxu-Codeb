import { describe, it, expect } from 'bun:test'
import {
  decideEffortRouting,
  validateEffortRoutingInput,
  calculateEffortLevel,
  calculateReasoningPreference,
  shouldUseDeepReviewPath,
  calculateTokenAllocation,
  type EffortRoutingInput
} from '../../effort-routing'

describe('Effort Routing 核心结构定义验证', () => {
  describe('1. decideEffortRouting 能返回合法决策', () => {
    it('应该为合法输入返回完整决策结构', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'medium',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: true
      }

      const decision = decideEffortRouting(input)

      // 验证必需字段
      expect(decision.effortLevel).toBeDefined()
      expect(['low', 'medium', 'high']).toContain(decision.effortLevel)

      expect(decision.reservedOutputTokens).toBeDefined()
      expect(decision.reservedOutputTokens).toBeGreaterThan(0)
      expect(decision.reservedOutputTokens).toBeLessThanOrEqual(input.tokenBudget)

      expect(decision.maxInputBudget).toBeDefined()
      expect(decision.maxInputBudget).toBeGreaterThan(0)
      expect(decision.maxInputBudget).toBeLessThanOrEqual(input.tokenBudget)

      expect(decision.reasoningPreference).toBeDefined()
      expect(['fast', 'balanced', 'deep']).toContain(decision.reasoningPreference)

      expect(decision.useDeepReviewPath).toBeDefined()
      expect(typeof decision.useDeepReviewPath).toBe('boolean')

      expect(decision.decidedAt).toBeDefined()
      expect(decision.decidedAt).toBeGreaterThan(0)

      // 验证扩展字段
      expect(decision.enableDetailedLogging).toBeDefined()
      expect(typeof decision.enableDetailedLogging).toBe('boolean')

      expect(decision.enableExtraSafetyChecks).toBeDefined()
      expect(typeof decision.enableExtraSafetyChecks).toBe('boolean')

      console.log('基础决策结果:', {
        effortLevel: decision.effortLevel,
        reservedOutputTokens: decision.reservedOutputTokens,
        maxInputBudget: decision.maxInputBudget,
        reasoningPreference: decision.reasoningPreference,
        useDeepReviewPath: decision.useDeepReviewPath,
        enableDetailedLogging: decision.enableDetailedLogging,
        enableExtraSafetyChecks: decision.enableExtraSafetyChecks
      })
    })

    it('应该为包含可选字段的输入返回决策', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 8,
        sliceRisk: 'high',
        tokenBudget: 20000,
        suggestedProfile: 'plan',
        requiresDeepReview: true,
        hasToolExecution: false,
        contextLength: 8000,
        timeLimit: 10,
        priority: 9
      }

      const decision = decideEffortRouting(input)

      // 验证决策结构完整
      expect(decision.effortLevel).toBeDefined()
      expect(decision.reservedOutputTokens).toBeDefined()
      expect(decision.maxInputBudget).toBeDefined()
      expect(decision.reasoningPreference).toBeDefined()
      expect(decision.useDeepReviewPath).toBeDefined()
      expect(decision.decidedAt).toBeGreaterThan(0)

      // 验证可选字段的影响
      console.log('完整输入决策结果:', {
        effortLevel: decision.effortLevel,
        reasoningPreference: decision.reasoningPreference,
        useDeepReviewPath: decision.useDeepReviewPath,
        suggestedThinkingTime: decision.suggestedThinkingTime
      })
    })
  })

  describe('2. 不同复杂度会得到不同 effortLevel', () => {
    it('低复杂度任务应该得到 low effortLevel', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 2,
        sliceRisk: 'low',
        tokenBudget: 5000,
        suggestedProfile: 'session',
        requiresDeepReview: false,
        hasToolExecution: false
      }

      const decision = decideEffortRouting(input)
      expect(decision.effortLevel).toBe('low')

      console.log('低复杂度决策:', {
        complexity: input.taskComplexity,
        effortLevel: decision.effortLevel
      })
    })

    it('中复杂度任务应该得到 medium effortLevel', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'medium',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: true
      }

      const decision = decideEffortRouting(input)
      expect(decision.effortLevel).toBe('medium')

      console.log('中复杂度决策:', {
        complexity: input.taskComplexity,
        effortLevel: decision.effortLevel
      })
    })

    it('高复杂度任务应该得到 high effortLevel', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 9,
        sliceRisk: 'high',
        tokenBudget: 20000,
        suggestedProfile: 'plan',
        requiresDeepReview: true,
        hasToolExecution: true
      }

      const decision = decideEffortRouting(input)
      expect(decision.effortLevel).toBe('high')

      console.log('高复杂度决策:', {
        complexity: input.taskComplexity,
        effortLevel: decision.effortLevel
      })
    })

    it('应该展示复杂度对effortLevel的连续影响', () => {
      const testCases = [
        { complexity: 1, expectedMin: 'low' },
        { complexity: 3, expectedMin: 'low' },
        { complexity: 5, expectedMin: 'medium' },
        { complexity: 7, expectedMin: 'medium' }
        // 复杂度9已经在单独的"高复杂度任务应该得到 high effortLevel"测试中覆盖
      ]

      testCases.forEach(({ complexity, expectedMin }) => {
        const input: EffortRoutingInput = {
          taskComplexity: complexity,
          sliceRisk: 'medium',
          tokenBudget: 10000,
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: false
        }

        const decision = decideEffortRouting(input)

        // 验证effortLevel不低于预期最小值
        const effortLevels = ['low', 'medium', 'high']
        const actualIndex = effortLevels.indexOf(decision.effortLevel)
        const expectedIndex = effortLevels.indexOf(expectedMin)

        // 注意：这里应该是 >=，因为expectedMin是"至少"的级别
        expect(actualIndex).toBeGreaterThanOrEqual(expectedIndex)

        console.log(`复杂度 ${complexity} -> ${decision.effortLevel} (预期至少: ${expectedMin})`)
      })
    })
  })

  describe('3. risk / review / toolExecution 会影响决策', () => {
    it('high risk 应该提高 effortLevel 或触发额外检查', () => {
      const lowRiskInput: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'low',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: true
      }

      const highRiskInput: EffortRoutingInput = {
        ...lowRiskInput,
        sliceRisk: 'high'
      }

      const lowRiskDecision = decideEffortRouting(lowRiskInput)
      const highRiskDecision = decideEffortRouting(highRiskInput)

      // high risk 应该导致更高的effortLevel或启用额外检查
      const effortLevels = ['low', 'medium', 'high']
      const lowRiskIndex = effortLevels.indexOf(lowRiskDecision.effortLevel)
      const highRiskIndex = effortLevels.indexOf(highRiskDecision.effortLevel)

      expect(highRiskIndex).toBeGreaterThanOrEqual(lowRiskIndex)

      // high risk 应该启用额外安全检查
      expect(highRiskDecision.enableExtraSafetyChecks).toBe(true)

      console.log('风险影响对比:', {
        lowRisk: { effort: lowRiskDecision.effortLevel, safety: lowRiskDecision.enableExtraSafetyChecks },
        highRisk: { effort: highRiskDecision.effortLevel, safety: highRiskDecision.enableExtraSafetyChecks }
      })
    })

    it('requiresDeepReview=true 应该触发 useDeepReviewPath', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'medium',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: true,
        hasToolExecution: false
      }

      const decision = decideEffortRouting(input)
      expect(decision.useDeepReviewPath).toBe(true)

      console.log('深度审查触发:', {
        requiresDeepReview: input.requiresDeepReview,
        useDeepReviewPath: decision.useDeepReviewPath
      })
    })

    it('hasToolExecution=true 应该影响安全决策和输出预算', () => {
      const noToolInput: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'medium',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: false
      }

      const withToolInput: EffortRoutingInput = {
        ...noToolInput,
        hasToolExecution: true
      }

      const noToolDecision = decideEffortRouting(noToolInput)
      const withToolDecision = decideEffortRouting(withToolInput)

      // 工具执行应该启用额外安全检查
      expect(withToolDecision.enableExtraSafetyChecks).toBe(true)

      // 工具执行可能影响effortLevel
      const effortLevels = ['low', 'medium', 'high']
      const noToolIndex = effortLevels.indexOf(noToolDecision.effortLevel)
      const withToolIndex = effortLevels.indexOf(withToolDecision.effortLevel)

      expect(withToolIndex).toBeGreaterThanOrEqual(noToolIndex)

      console.log('工具执行影响:', {
        noTool: { effort: noToolDecision.effortLevel, safety: noToolDecision.enableExtraSafetyChecks },
        withTool: { effort: withToolDecision.effortLevel, safety: withToolDecision.enableExtraSafetyChecks }
      })
    })

    it('高风险+工具执行应该触发深度审查路径', () => {
      const input: EffortRoutingInput = {
        taskComplexity: 7,
        sliceRisk: 'high',
        tokenBudget: 15000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: true
      }

      const decision = decideEffortRouting(input)

      // 高风险+工具执行应该触发深度审查
      expect(decision.useDeepReviewPath).toBe(true)
      expect(decision.enableExtraSafetyChecks).toBe(true)
      expect(decision.enableDetailedLogging).toBe(true)

      console.log('高风险工具执行决策:', {
        useDeepReviewPath: decision.useDeepReviewPath,
        enableExtraSafetyChecks: decision.enableExtraSafetyChecks,
        enableDetailedLogging: decision.enableDetailedLogging,
        effortLevel: decision.effortLevel
      })
    })
  })

  describe('4. tokenBudget 分配逻辑有效', () => {
    it('应该为不同预算返回合法分配', () => {
      const testBudgets = [1000, 5000, 10000, 20000, 50000]

      testBudgets.forEach(budget => {
        const input: EffortRoutingInput = {
          taskComplexity: 5,
          sliceRisk: 'medium',
          tokenBudget: budget,
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const decision = decideEffortRouting(input)

        // 验证分配合法性
        expect(decision.reservedOutputTokens).toBeGreaterThan(0)
        expect(decision.reservedOutputTokens).toBeLessThan(budget)

        expect(decision.maxInputBudget).toBeGreaterThan(0)
        expect(decision.maxInputBudget).toBeLessThanOrEqual(budget)

        // 验证总和不超过总预算
        const totalUsed = decision.reservedOutputTokens + decision.maxInputBudget
        expect(totalUsed).toBeLessThanOrEqual(budget)

        console.log(`预算分配 ${budget}:`, {
          reservedOutput: decision.reservedOutputTokens,
          maxInput: decision.maxInputBudget,
          totalUsed,
          remaining: budget - totalUsed
        })
      })
    })

    it('应该为小预算返回合法结构', () => {
      const smallBudgetInput: EffortRoutingInput = {
        taskComplexity: 3,
        sliceRisk: 'low',
        tokenBudget: 500, // 很小预算
        suggestedProfile: 'session',
        requiresDeepReview: false,
        hasToolExecution: false
      }

      const decision = decideEffortRouting(smallBudgetInput)

      // 验证结构完整
      expect(decision.effortLevel).toBeDefined()
      expect(decision.reservedOutputTokens).toBeGreaterThan(0)
      expect(decision.maxInputBudget).toBeGreaterThan(0)
      expect(decision.reasoningPreference).toBeDefined()
      expect(decision.useDeepReviewPath).toBeDefined()

      // 验证分配合理性
      expect(decision.reservedOutputTokens).toBeLessThanOrEqual(smallBudgetInput.tokenBudget)
      expect(decision.maxInputBudget).toBeLessThanOrEqual(smallBudgetInput.tokenBudget)

      console.log('小预算决策:', {
        budget: smallBudgetInput.tokenBudget,
        reservedOutput: decision.reservedOutputTokens,
        maxInput: decision.maxInputBudget
      })
    })

    it('高风险任务应该分配更多输出token', () => {
      const lowRiskInput: EffortRoutingInput = {
        taskComplexity: 5,
        sliceRisk: 'low',
        tokenBudget: 10000,
        suggestedProfile: 'edit',
        requiresDeepReview: false,
        hasToolExecution: false
      }

      const highRiskInput: EffortRoutingInput = {
        ...lowRiskInput,
        sliceRisk: 'high'
      }

      const lowRiskDecision = decideEffortRouting(lowRiskInput)
      const highRiskDecision = decideEffortRouting(highRiskInput)

      // 高风险应该分配更多输出token（比例更高）
      const lowRiskOutputRatio = lowRiskDecision.reservedOutputTokens / lowRiskInput.tokenBudget
      const highRiskOutputRatio = highRiskDecision.reservedOutputTokens / highRiskInput.tokenBudget

      expect(highRiskOutputRatio).toBeGreaterThan(lowRiskOutputRatio)

      console.log('风险对输出token分配的影响:', {
        lowRisk: { tokens: lowRiskDecision.reservedOutputTokens, ratio: lowRiskOutputRatio.toFixed(3) },
        highRisk: { tokens: highRiskDecision.reservedOutputTokens, ratio: highRiskOutputRatio.toFixed(3) }
      })
    })
  })

  describe('5. 辅助函数有效', () => {
    describe('validateEffortRoutingInput', () => {
      it('应该验证合法输入', () => {
        const validInput: EffortRoutingInput = {
          taskComplexity: 5,
          sliceRisk: 'medium',
          tokenBudget: 10000,
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const validation = validateEffortRoutingInput(validInput)
        expect(validation.valid).toBe(true)
        expect(validation.errors).toEqual([])
      })

      it('应该拒绝非法复杂度', () => {
        const invalidInput: any = {
          taskComplexity: 0, // 非法：小于1
          sliceRisk: 'medium',
          tokenBudget: 10000,
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const validation = validateEffortRoutingInput(invalidInput)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('任务复杂度必须在1-10之间')
      })

      it('应该拒绝非法风险等级', () => {
        const invalidInput: any = {
          taskComplexity: 5,
          sliceRisk: 'invalid', // 非法风险等级
          tokenBudget: 10000,
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const validation = validateEffortRoutingInput(invalidInput)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('风险等级必须是 low、medium 或 high')
      })

      it('应该拒绝非法token预算', () => {
        const invalidInput: any = {
          taskComplexity: 5,
          sliceRisk: 'medium',
          tokenBudget: 0, // 非法：必须大于0
          suggestedProfile: 'edit',
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const validation = validateEffortRoutingInput(invalidInput)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('token预算必须大于0')
      })

      it('应该拒绝非法剖面类型', () => {
        const invalidInput: any = {
          taskComplexity: 5,
          sliceRisk: 'medium',
          tokenBudget: 10000,
          suggestedProfile: 'invalid', // 非法剖面
          requiresDeepReview: false,
          hasToolExecution: true
        }

        const validation = validateEffortRoutingInput(invalidInput)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('建议剖面必须是 plan、edit、review 或 session')
      })
    })

    describe('calculateEffortLevel', () => {
      it('应该计算正确的工作量等级', () => {
        // 注意：calculateEffortLevel 不是直接导出的，我们通过decideEffortRouting测试
        const testCases = [
          {
            input: {
              taskComplexity: 2,
              sliceRisk: 'low' as const,
              suggestedProfile: 'session' as const,
              hasToolExecution: false,
              requiresDeepReview: false
            },
            expectedMin: 'low'
          },
          {
            input: {
              taskComplexity: 5,
              sliceRisk: 'medium' as const,
              suggestedProfile: 'edit' as const,
              hasToolExecution: true,
              requiresDeepReview: false
            },
            expectedMin: 'medium'
          },
          {
            input: {
              taskComplexity: 9,
              sliceRisk: 'high' as const,
              suggestedProfile: 'plan' as const,
              hasToolExecution: true,
              requiresDeepReview: true
            },
            expectedMin: 'high'
          }
        ]

        testCases.forEach(({ input, expectedMin }) => {
          const fullInput: EffortRoutingInput = {
            ...input,
            tokenBudget: 10000
          }

          const decision = decideEffortRouting(fullInput)
          const effortLevels = ['low', 'medium', 'high']
          const actualIndex = effortLevels.indexOf(decision.effortLevel)
          const expectedIndex = effortLevels.indexOf(expectedMin)

          expect(actualIndex).toBeGreaterThanOrEqual(expectedIndex)

          console.log(`工作量等级计算:`, {
            ...input,
            effortLevel: decision.effortLevel,
            expectedMin
          })
        })
      })
    })

    describe('calculateReasoningPreference', () => {
      it('应该根据输入计算推理偏好', () => {
        // 通过完整决策测试推理偏好
        const testCases = [
          {
            input: {
              taskComplexity: 9,
              sliceRisk: 'high' as const,
              suggestedProfile: 'plan' as const,
              timeLimit: undefined,
              priority: undefined
            },
            expected: 'deep' // 高风险或高复杂度 -> deep
          },
          {
            input: {
              taskComplexity: 5,
              sliceRisk: 'medium' as const,
              suggestedProfile: 'edit' as const,
              timeLimit: 3, // 时间紧迫
              priority: undefined
            },
            expected: 'fast' // 时间紧迫 -> fast
          },
          {
            input: {
              taskComplexity: 5,
              sliceRisk: 'medium' as const,
              suggestedProfile: 'review' as const,
              timeLimit: undefined,
              priority: 9 // 高优先级
            },
            expected: 'balanced' // 高优先级 -> balanced
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const fullInput: EffortRoutingInput = {
            ...input,
            tokenBudget: 10000,
            requiresDeepReview: false,
            hasToolExecution: false
          }

          const decision = decideEffortRouting(fullInput)
          expect(decision.reasoningPreference).toBe(expected)

          console.log(`推理偏好计算:`, {
            ...input,
            reasoningPreference: decision.reasoningPreference,
            expected
          })
        })
      })
    })

    describe('shouldUseDeepReviewPath', () => {
      it('应该正确判断是否使用深度审查路径', () => {
        const testCases = [
          {
            input: {
              requiresDeepReview: true,
              sliceRisk: 'low' as const,
              taskComplexity: 3,
              suggestedProfile: 'session' as const,
              hasToolExecution: false
            },
            expected: true // 明确要求深度审查
          },
          {
            input: {
              requiresDeepReview: false,
              sliceRisk: 'high' as const,
              taskComplexity: 5,
              suggestedProfile: 'edit' as const,
              hasToolExecution: false
            },
            expected: true // 高风险
          },
          {
            input: {
              requiresDeepReview: false,
              sliceRisk: 'medium' as const,
              taskComplexity: 8, // 高复杂度
              suggestedProfile: 'plan' as const,
              hasToolExecution: false
            },
            expected: true // 高复杂度
          },
          {
            input: {
              requiresDeepReview: false,
              sliceRisk: 'medium' as const,
              taskComplexity: 5,
              suggestedProfile: 'edit' as const,
              hasToolExecution: true // 编辑+工具执行
            },
            expected: true
          },
          {
            input: {
              requiresDeepReview: false,
              sliceRisk: 'low' as const,
              taskComplexity: 3,
              suggestedProfile: 'session' as const,
              hasToolExecution: false
            },
            expected: false // 都不满足
          }
        ]

        testCases.forEach(({ input, expected }) => {
          const fullInput: EffortRoutingInput = {
            ...input,
            tokenBudget: 10000
          }

          const decision = decideEffortRouting(fullInput)
          expect(decision.useDeepReviewPath).toBe(expected)

          console.log(`深度审查路径判断:`, {
            ...input,
            useDeepReviewPath: decision.useDeepReviewPath,
            expected
          })
        })
      })
    })

    describe('calculateTokenAllocation', () => {
      it('应该计算合理的token分配', () => {
        const testCases: EffortRoutingInput[] = [
          {
            taskComplexity: 5,
            sliceRisk: 'medium',
            tokenBudget: 10000,
            suggestedProfile: 'edit',
            requiresDeepReview: false,
            hasToolExecution: true
          },
          {
            taskComplexity: 8,
            sliceRisk: 'high',
            tokenBudget: 20000,
            suggestedProfile: 'plan',
            requiresDeepReview: true,
            hasToolExecution: false
          },
          {
            taskComplexity: 2,
            sliceRisk: 'low',
            tokenBudget: 5000,
            suggestedProfile: 'session',
            requiresDeepReview: false,
            hasToolExecution: false
          }
        ]

        testCases.forEach(input => {
          const decision = decideEffortRouting(input)

          // 调试信息
          console.log(`调试Token分配:`, {
            input,
            decision: {
              effortLevel: decision.effortLevel,
              reservedOutputTokens: decision.reservedOutputTokens,
              maxInputBudget: decision.maxInputBudget
            }
          })

          // 验证分配合法性
          expect(decision.reservedOutputTokens).toBeGreaterThan(0)
          expect(decision.reservedOutputTokens).toBeLessThan(input.tokenBudget)

          expect(decision.maxInputBudget).toBeGreaterThan(0)
          expect(decision.maxInputBudget).toBeLessThanOrEqual(input.tokenBudget)

          // 验证总和不超过总预算
          const totalUsed = decision.reservedOutputTokens + decision.maxInputBudget
          expect(totalUsed).toBeLessThanOrEqual(input.tokenBudget)

          // 计算输出比例
          const outputRatio = decision.reservedOutputTokens / input.tokenBudget
          expect(outputRatio).toBeGreaterThanOrEqual(0.15) // 至少15%
          expect(outputRatio).toBeLessThanOrEqual(0.5) // 最多50%

          console.log(`Token分配计算:`, {
            budget: input.tokenBudget,
            reservedOutput: decision.reservedOutputTokens,
            maxInput: decision.maxInputBudget,
            outputRatio: outputRatio.toFixed(3),
            effortLevel: decision.effortLevel
          })
        })
      })
    })
  })
})