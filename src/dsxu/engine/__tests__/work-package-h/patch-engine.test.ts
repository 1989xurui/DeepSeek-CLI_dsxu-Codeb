import { describe, it, expect } from 'bun:test'
import {
  PatchStrategy,
  PATCH_STRATEGY_PRIORITY,
  PATCH_STRATEGY_CONFIGS,
  getPatchStrategyPriority,
  comparePatchStrategyPriority,
  choosePatchStrategy,
  canFallbackToNextStrategy,
  getNextFallbackStrategy,
  getFallbackChain
} from '../../patch-engine'

describe('Patch Engine - 策略定义与优先级', () => {
  describe('1. 策略集合存在', () => {
    it('应该包含 str_replace, diff_replace, whole_file 三种策略', () => {
      // 验证策略类型存在
      const strategies: PatchStrategy[] = ['str_replace', 'diff_replace', 'whole_file']

      strategies.forEach(strategy => {
        expect(PATCH_STRATEGY_PRIORITY).toContain(strategy)
        expect(PATCH_STRATEGY_CONFIGS).toHaveProperty(strategy)
      })

      // 验证没有多余策略
      expect(PATCH_STRATEGY_PRIORITY.length).toBe(3)
      expect(Object.keys(PATCH_STRATEGY_CONFIGS).length).toBe(3)
    })

    it('每个策略都应该有完整的配置', () => {
      const requiredConfigKeys = ['strategy', 'description', 'allowFallback', 'maxRetries', 'timeoutMs']

      for (const strategy of PATCH_STRATEGY_PRIORITY) {
        const config = PATCH_STRATEGY_CONFIGS[strategy]

        // 验证配置对象存在
        expect(config).toBeDefined()

        // 验证所有必需字段都存在
        requiredConfigKeys.forEach(key => {
          expect(config).toHaveProperty(key)
        })

        // 验证策略类型匹配
        expect(config.strategy).toBe(strategy)
      }
    })
  })

  describe('2. 默认优先级正确', () => {
    it('str_replace 应该优先于 diff_replace', () => {
      const strReplacePriority = getPatchStrategyPriority('str_replace')
      const diffReplacePriority = getPatchStrategyPriority('diff_replace')

      expect(strReplacePriority).toBeLessThan(diffReplacePriority)
    })

    it('diff_replace 应该优先于 whole_file', () => {
      const diffReplacePriority = getPatchStrategyPriority('diff_replace')
      const wholeFilePriority = getPatchStrategyPriority('whole_file')

      expect(diffReplacePriority).toBeLessThan(wholeFilePriority)
    })

    it('whole_file 应该是优先级最低的策略', () => {
      const wholeFilePriority = getPatchStrategyPriority('whole_file')
      const maxPriority = PATCH_STRATEGY_PRIORITY.length - 1

      expect(wholeFilePriority).toBe(maxPriority)
    })

    it('PATCH_STRATEGY_PRIORITY 数组应该按优先级排序', () => {
      expect(PATCH_STRATEGY_PRIORITY[0]).toBe('str_replace')
      expect(PATCH_STRATEGY_PRIORITY[1]).toBe('diff_replace')
      expect(PATCH_STRATEGY_PRIORITY[2]).toBe('whole_file')
    })
  })

  describe('3. 选择函数有效', () => {
    it('默认情况下应该优先选择 str_replace', () => {
      const chosen = choosePatchStrategy()
      expect(chosen).toBe('str_replace')
    })

    it('当首选策略不可用时，应该选择下一个可用策略', () => {
      // 测试 str_replace 不可用的情况
      const availableStrategies: PatchStrategy[] = ['diff_replace', 'whole_file']
      const chosen = choosePatchStrategy(availableStrategies, 'str_replace')
      expect(chosen).toBe('diff_replace')

      // 测试 diff_replace 不可用的情况
      const availableStrategies2: PatchStrategy[] = ['whole_file']
      const chosen2 = choosePatchStrategy(availableStrategies2, 'diff_replace')
      expect(chosen2).toBe('whole_file')
    })

    it('当没有可用策略时，应该返回 whole_file 作为默认', () => {
      const chosen = choosePatchStrategy([], 'str_replace')
      expect(chosen).toBe('whole_file')
    })

    it('应该尊重首选策略（如果可用）', () => {
      const chosen = choosePatchStrategy(['str_replace', 'diff_replace'], 'diff_replace')
      expect(chosen).toBe('diff_replace')
    })
  })

  describe('4. 回退规则有效', () => {
    it('str_replace 失败时应该允许回退到 diff_replace', () => {
      const canFallback = canFallbackToNextStrategy('str_replace', 'diff_replace')
      expect(canFallback).toBe(true)
    })

    it('diff_replace 失败时应该允许回退到 whole_file', () => {
      const canFallback = canFallbackToNextStrategy('diff_replace', 'whole_file')
      expect(canFallback).toBe(true)
    })

    it('whole_file 不应该允许继续回退', () => {
      // whole_file 到任何策略都不应该允许回退
      const canFallback = canFallbackToNextStrategy('whole_file', 'str_replace')
      expect(canFallback).toBe(false)
    })

    it('getNextFallbackStrategy() 应该返回正确的下一个策略', () => {
      // str_replace 的下一个回退策略应该是 diff_replace
      const nextFromStrReplace = getNextFallbackStrategy('str_replace')
      expect(nextFromStrReplace).toBe('diff_replace')

      // diff_replace 的下一个回退策略应该是 whole_file
      const nextFromDiffReplace = getNextFallbackStrategy('diff_replace')
      expect(nextFromDiffReplace).toBe('whole_file')

      // whole_file 不应该有下一个回退策略
      const nextFromWholeFile = getNextFallbackStrategy('whole_file')
      expect(nextFromWholeFile).toBeNull()
    })

    it('getFallbackChain() 应该返回完整的回退链', () => {
      // 从 str_replace 开始的完整回退链
      const chainFromStrReplace = getFallbackChain('str_replace')
      expect(chainFromStrReplace).toEqual(['str_replace', 'diff_replace', 'whole_file'])

      // 从 diff_replace 开始的回退链
      const chainFromDiffReplace = getFallbackChain('diff_replace')
      expect(chainFromDiffReplace).toEqual(['diff_replace', 'whole_file'])

      // 从 whole_file 开始的回退链（只有自己）
      const chainFromWholeFile = getFallbackChain('whole_file')
      expect(chainFromWholeFile).toEqual(['whole_file'])
    })

    it('当某些策略不可用时，回退链应该跳过不可用策略', () => {
      // str_replace 和 whole_file 可用，但 diff_replace 不可用
      // 应该从 str_replace 直接回退到 whole_file，跳过 diff_replace
      const availableStrategies: PatchStrategy[] = ['str_replace', 'whole_file']
      const chain = getFallbackChain('str_replace', availableStrategies)
      expect(chain).toEqual(['str_replace', 'whole_file'])

      // 只有 whole_file 可用，从 diff_replace 开始
      // 应该包含 diff_replace 和 whole_file，因为可以从 diff_replace 回退到 whole_file
      const availableStrategies2: PatchStrategy[] = ['whole_file']
      const chain2 = getFallbackChain('diff_replace', availableStrategies2)
      expect(chain2).toEqual(['diff_replace', 'whole_file'])
    })
  })

  describe('5. 优先级比较函数有效', () => {
    it('getPatchStrategyPriority() 应该返回正确的优先级数值', () => {
      expect(getPatchStrategyPriority('str_replace')).toBe(0)
      expect(getPatchStrategyPriority('diff_replace')).toBe(1)
      expect(getPatchStrategyPriority('whole_file')).toBe(2)
    })

    it('comparePatchStrategyPriority() 应该正确比较优先级', () => {
      // str_replace 优先级高于 diff_replace
      expect(comparePatchStrategyPriority('str_replace', 'diff_replace')).toBe(-1)

      // diff_replace 优先级低于 str_replace
      expect(comparePatchStrategyPriority('diff_replace', 'str_replace')).toBe(1)

      // 相同策略比较结果为0
      expect(comparePatchStrategyPriority('str_replace', 'str_replace')).toBe(0)
      expect(comparePatchStrategyPriority('diff_replace', 'diff_replace')).toBe(0)
      expect(comparePatchStrategyPriority('whole_file', 'whole_file')).toBe(0)
    })

    it('优先级比较应该与默认优先级顺序一致', () => {
      for (let i = 0; i < PATCH_STRATEGY_PRIORITY.length; i++) {
        for (let j = 0; j < PATCH_STRATEGY_PRIORITY.length; j++) {
          const strategyA = PATCH_STRATEGY_PRIORITY[i]
          const strategyB = PATCH_STRATEGY_PRIORITY[j]
          const comparison = comparePatchStrategyPriority(strategyA, strategyB)

          if (i < j) {
            expect(comparison).toBe(-1) // A优先级更高
          } else if (i > j) {
            expect(comparison).toBe(1)  // B优先级更高
          } else {
            expect(comparison).toBe(0)  // 优先级相同
          }
        }
      }
    })
  })
})
