/**
 * DSXU Patch Engine - 编辑原语优先级定义
 *
 * 定义最小编辑原语集合与优先级规则
 * Work Package H - 步骤1
 */

/**
 * 编辑原语类型
 */
export type PatchStrategy =
  | 'str_replace'   // 字符串替换：精确匹配并替换特定字符串
  | 'diff_replace'  // 差异替换：基于差异的智能替换
  | 'whole_file'    // 全文件替换：替换整个文件内容

/**
 * 编辑原语优先级顺序
 * 默认优先级：str_replace > diff_replace > whole_file
 */
export const PATCH_STRATEGY_PRIORITY: PatchStrategy[] = [
  'str_replace',
  'diff_replace',
  'whole_file'
]

/**
 * 编辑原语配置
 */
export interface PatchStrategyConfig {
  /** 策略类型 */
  strategy: PatchStrategy
  /** 策略描述 */
  description: string
  /** 是否允许回退到下一个策略 */
  allowFallback: boolean
  /** 最大重试次数 */
  maxRetries: number
  /** 超时时间（毫秒） */
  timeoutMs: number
}

/**
 * 编辑原语配置映射
 */
export const PATCH_STRATEGY_CONFIGS: Record<PatchStrategy, PatchStrategyConfig> = {
  str_replace: {
    strategy: 'str_replace',
    description: '精确字符串替换：匹配并替换特定字符串片段',
    allowFallback: true,    // 失败时可回退到diff_replace
    maxRetries: 2,
    timeoutMs: 5000
  },
  diff_replace: {
    strategy: 'diff_replace',
    description: '差异替换：基于差异对比的智能替换',
    allowFallback: true,    // 失败时可回退到whole_file
    maxRetries: 1,
    timeoutMs: 10000
  },
  whole_file: {
    strategy: 'whole_file',
    description: '全文件替换：直接替换整个文件内容',
    allowFallback: false,   // 最终策略，不允许回退
    maxRetries: 0,
    timeoutMs: 3000
  }
}

/**
 * 获取策略优先级
 * @param strategy 策略类型
 * @returns 优先级数值（0为最高优先级）
 */
export function getPatchStrategyPriority(strategy: PatchStrategy): number {
  return PATCH_STRATEGY_PRIORITY.indexOf(strategy)
}

/**
 * 比较两个策略的优先级
 * @param strategyA 策略A
 * @param strategyB 策略B
 * @returns 比较结果：-1表示A优先级更高，1表示B优先级更高，0表示相同
 */
export function comparePatchStrategyPriority(
  strategyA: PatchStrategy,
  strategyB: PatchStrategy
): number {
  const priorityA = getPatchStrategyPriority(strategyA)
  const priorityB = getPatchStrategyPriority(strategyB)

  if (priorityA < priorityB) return -1  // A优先级更高
  if (priorityA > priorityB) return 1   // B优先级更高
  return 0  // 优先级相同
}

/**
 * 选择编辑策略
 * @param availableStrategies 可用策略列表
 * @param preferredStrategy 首选策略（可选）
 * @returns 选择的策略
 */
export function choosePatchStrategy(
  availableStrategies: PatchStrategy[] = PATCH_STRATEGY_PRIORITY,
  preferredStrategy?: PatchStrategy
): PatchStrategy {
  // 如果有首选策略且可用，则使用首选策略
  if (preferredStrategy && availableStrategies.includes(preferredStrategy)) {
    return preferredStrategy
  }

  // 否则按优先级选择第一个可用策略
  for (const strategy of PATCH_STRATEGY_PRIORITY) {
    if (availableStrategies.includes(strategy)) {
      return strategy
    }
  }

  // 如果没有可用策略，返回默认策略
  return 'whole_file'
}

/**
 * 检查是否允许回退到下一个策略
 * @param currentStrategy 当前策略
 * @param nextStrategy 下一个策略
 * @returns 是否允许回退
 */
export function canFallbackToNextStrategy(
  currentStrategy: PatchStrategy,
  nextStrategy: PatchStrategy
): boolean {
  const currentConfig = PATCH_STRATEGY_CONFIGS[currentStrategy]
  const nextConfig = PATCH_STRATEGY_CONFIGS[nextStrategy]

  // 当前策略允许回退，且下一个策略优先级更低
  return currentConfig.allowFallback &&
         comparePatchStrategyPriority(currentStrategy, nextStrategy) < 0
}

/**
 * 获取下一个回退策略
 * @param currentStrategy 当前策略
 * @param availableStrategies 可用策略列表
 * @returns 下一个回退策略，如果没有则返回null
 */
export function getNextFallbackStrategy(
  currentStrategy: PatchStrategy,
  availableStrategies: PatchStrategy[] = PATCH_STRATEGY_PRIORITY
): PatchStrategy | null {
  const currentPriority = getPatchStrategyPriority(currentStrategy)

  // 从当前策略之后查找下一个可用策略
  for (let i = currentPriority + 1; i < PATCH_STRATEGY_PRIORITY.length; i++) {
    const nextStrategy = PATCH_STRATEGY_PRIORITY[i]
    if (availableStrategies.includes(nextStrategy) &&
        canFallbackToNextStrategy(currentStrategy, nextStrategy)) {
      return nextStrategy
    }
  }

  return null
}

/**
 * 获取所有允许的回退策略链
 * @param startStrategy 起始策略
 * @param availableStrategies 可用策略列表
 * @returns 回退策略链（从起始策略到最终策略）
 */
export function getFallbackChain(
  startStrategy: PatchStrategy,
  availableStrategies: PatchStrategy[] = PATCH_STRATEGY_PRIORITY
): PatchStrategy[] {
  const chain: PatchStrategy[] = [startStrategy]
  let current = startStrategy

  while (true) {
    const next = getNextFallbackStrategy(current, availableStrategies)
    if (!next) break
    chain.push(next)
    current = next
  }

  return chain
}
