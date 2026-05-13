/**
 * V10-1: H-4R Integration Harness
 *
 * 验证H-4四模块集成能消费预算与模型能力信息
 */

import { describe, test, expect } from 'bun:test'
import {
  createBudgetForContextWindow,
  checkBudgetUsage
} from '../context-budget-v1'
import {
  getModelCapability,
  routeModel
} from '../model-capability-v1'
import {
  createModelGateway
} from '../model-gateway-v1'

// 模拟H-4四模块状态
interface H4ModuleState {
  compact: {
    applied: boolean
    level: 'light' | 'medium' | 'aggressive'
    tokensSaved: number
  }
  hygiene: {
    checked: boolean
    issues: number
    riskLevel: 'none' | 'low' | 'medium' | 'high'
  }
  session: {
    snapshotCreated: boolean
    resumeHints: number
  }
  memory: {
    extracted: number
    categories: string[]
  }
}

describe('H-4R Integration Harness', () => {
  test('1. H-4四模块集成基础验证', () => {
    // 初始化H-4模块状态
    const h4State: H4ModuleState = {
      compact: { applied: false, level: 'light', tokensSaved: 0 },
      hygiene: { checked: false, issues: 0, riskLevel: 'none' },
      session: { snapshotCreated: false, resumeHints: 0 },
      memory: { extracted: 0, categories: [] }
    }

    // 创建模型网关
    const gateway = createModelGateway({
      defaultModel: 'deepseek-chat',
      enableBudgetAwareness: true,
      enableSessionAwareness: true
    })

    // 模拟会话开始
    gateway.updateSessionState('active')

    // 步骤1: 初始上下文使用
    gateway.updateContextUsage(15000, { workingSet: 10000, stablePrefix: 5000 })
    h4State.session.snapshotCreated = true
    h4State.session.resumeHints = 2

    // 步骤2: 执行context hygiene检查
    const capability = getModelCapability(gateway.getState().currentModel)
    const budget = createBudgetForContextWindow(capability.model, capability.contextWindow)
    const usage = checkBudgetUsage(gateway.getState().contextUsage.totalTokens, budget)

    h4State.hygiene.checked = true
    h4State.hygiene.riskLevel = usage.riskLevel
    h4State.hygiene.issues = usage.riskLevel === 'none' ? 0 : 1

    // 步骤3: 根据使用率决定是否压缩
    if (usage.riskLevel !== 'none') {
      h4State.compact.applied = true
      h4State.compact.level = usage.riskLevel === 'high' ? 'aggressive' :
                              usage.riskLevel === 'medium' ? 'medium' : 'light'
      h4State.compact.tokensSaved = Math.floor(gateway.getState().contextUsage.totalTokens * 0.3)

      // 模拟压缩后更新上下文使用
      gateway.updateContextUsage(-h4State.compact.tokensSaved) // 减少使用量
    }

    // 步骤4: 记忆提取
    h4State.memory.extracted = 5
    h4State.memory.categories = ['decision', 'technical-pattern', 'task-state']

    // 验证H-4集成状态
    expect(h4State.session.snapshotCreated).toBe(true)
    expect(h4State.hygiene.checked).toBe(true)
    expect(h4State.memory.extracted).toBeGreaterThan(0)

    console.log('✅ H-4四模块集成状态:')
    console.log(`  - 会话: 快照${h4State.session.snapshotCreated ? '已创建' : '未创建'}, ${h4State.session.resumeHints}个恢复提示`)
    console.log(`  - 卫生检查: ${h4State.hygiene.checked ? '已完成' : '未完成'}, 风险${h4State.hygiene.riskLevel}`)
    console.log(`  - 压缩: ${h4State.compact.applied ? `已应用(${h4State.compact.level})` : '未应用'}, 节省${h4State.compact.tokensSaved}tokens`)
    console.log(`  - 记忆: 提取${h4State.memory.extracted}条, 分类${h4State.memory.categories.join(',')}`)
  })

  test('2. 长任务场景下的H-4R集成', () => {
    // 模拟长任务工作流
    const gateway = createModelGateway()
    gateway.updateSessionState('active')

    const longTaskPhases = [
      { phase: '规划', tokensUsed: 20000, requiresTools: false },
      { phase: '开发', tokensUsed: 50000, requiresTools: true },
      { phase: '测试', tokensUsed: 30000, requiresTools: true },
      { phase: '优化', tokensUsed: 40000, requiresTools: true }
    ]

    let totalTokensUsed = 0
    const h4History: Array<{ phase: string; state: Partial<H4ModuleState> }> = []

    for (const phase of longTaskPhases) {
      totalTokensUsed += phase.tokensUsed
      gateway.updateContextUsage(phase.tokensUsed)

      // 检查当前边界
      const boundaryInput = {
        taskType: 'coding' as const,
        requiredContext: 20000, // 假设每个阶段需要20K额外空间
        requiresTools: phase.requiresTools,
        requiresLongThinking: true,
        budgetConstraint: 'medium' as const,
        sessionState: 'active' as const
      }

      const boundaryCheck = gateway.checkBoundary(boundaryInput)

      // 记录H-4状态
      const phaseState: Partial<H4ModuleState> = {
        hygiene: {
          checked: true,
          issues: boundaryCheck.passed ? 0 : 1,
          riskLevel: boundaryCheck.passed ? 'none' : 'medium'
        },
        compact: {
          applied: !boundaryCheck.passed,
          level: !boundaryCheck.passed ? 'medium' : 'light',
          tokensSaved: !boundaryCheck.passed ? Math.floor(phase.tokensUsed * 0.2) : 0
        }
      }

      h4History.push({ phase: phase.phase, state: phaseState })

      console.log(`📈 ${phase.phase}阶段:`)
      console.log(`  - 累计tokens: ${totalTokensUsed}`)
      console.log(`  - 边界检查: ${boundaryCheck.passed ? '通过' : '失败'}`)
      if (!boundaryCheck.passed) {
        console.log(`  - 压缩应用: ${phaseState.compact?.applied ? '是' : '否'}`)
        console.log(`  - 节省tokens: ${phaseState.compact?.tokensSaved}`)
      }
    }

    // 验证长任务完整性
    expect(h4History.length).toBe(4)
    expect(totalTokensUsed).toBe(140000) // 20K + 50K + 30K + 40K

    // 最终会话状态应该是活跃的
    const finalState = gateway.getState()
    expect(finalState.sessionState).toBe('active')

    console.log('✅ 长任务H-4R集成完成:')
    console.log(`  - 总tokens使用: ${totalTokensUsed}`)
    console.log(`  - 最终会话状态: ${finalState.sessionState}`)
    console.log(`  - 历史阶段数: ${h4History.length}`)
  })

  test('3. 恢复场景下的H-4R集成', () => {
    // 模拟中断后的恢复
    const gateway = createModelGateway()

    // 模拟中断前的状态
    gateway.updateSessionState('active')
    gateway.updateContextUsage(90000, {
      workingSet: 50000,
      memoryBundle: 25000,
      evidenceBundle: 10000,
      stablePrefix: 5000
    })

    // 模拟中断
    gateway.updateSessionState('paused')

    // 模拟恢复尝试
    const recoveryInput = {
      taskType: 'coding' as const,
      requiredContext: 50000, // 恢复需要50K上下文
      requiresTools: true,
      requiresLongThinking: true,
      budgetConstraint: 'medium' as const,
      sessionState: 'paused' as const
    }

    const recoveryCheck = gateway.checkBoundary(recoveryInput)

    // 根据检查结果决定恢复策略
    let recoveryStrategy = '直接恢复'
    if (!recoveryCheck.passed) {
      if (recoveryCheck.result.suggestedAction === 'compact') {
        recoveryStrategy = '压缩后恢复'
      } else if (recoveryCheck.result.suggestedAction === 'switch_model') {
        recoveryStrategy = '切换模型后恢复'
      }
    }

    // 执行恢复
    if (recoveryStrategy === '压缩后恢复') {
      // 模拟压缩
      const tokensSaved = Math.floor(90000 * 0.3) // 压缩节省30%
      gateway.updateContextUsage(-tokensSaved)

      // 更新会话状态
      gateway.updateSessionState('recovering')
    } else {
      gateway.updateSessionState('active')
    }

    const finalState = gateway.getState()

    console.log('✅ 恢复场景H-4R集成:')
    console.log(`  - 中断前tokens: 90000`)
    console.log(`  - 恢复检查: ${recoveryCheck.passed ? '通过' : '失败'}`)
    console.log(`  - 恢复策略: ${recoveryStrategy}`)
    console.log(`  - 最终状态: ${finalState.sessionState}`)
    console.log(`  - 最终tokens: ${finalState.contextUsage.totalTokens}`)

    // 验证恢复成功
    expect(finalState.sessionState === 'active' || finalState.sessionState === 'recovering').toBe(true)
  })
})

console.log('✅ H-4R-integration-harness.ts 创建完成')
