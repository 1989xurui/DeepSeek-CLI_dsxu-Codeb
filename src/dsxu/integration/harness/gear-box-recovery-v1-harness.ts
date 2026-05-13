import { createGearBox } from '../../engine/gear-box'
import type { RecoveryDecision } from '../../engine/recovery/recovery-types-v3'

/**
 * Gear Box Recovery V1 Harness
 * 验证gear-box与Recovery Decision的联动
 */
export class GearBoxRecoveryV1Harness {
  private gearBox: ReturnType<typeof createGearBox>

  constructor() {
    this.gearBox = createGearBox()
  }

  /**
   * 模拟恢复决策应用
   */
  simulateRecoveryDecisionApplication(options: {
    initialGear: 1 | 2 | 3
    decision: RecoveryDecision
    description: string
  }): {
    scenario: string
    initialState: any
    decision: RecoveryDecision
    finalState: any
    analysis: {
      gearChanged: boolean
      gearChangeDirection: 'up' | 'down' | 'same'
      expectedBehavior: string
    }
  } {
    console.log(`\n=== 恢复决策应用模拟: ${options.description} ===`)

    // 设置初始档位
    this.resetToGear(options.initialGear)
    const initialState = this.gearBox.getState()

    console.log(`初始档位: ${initialState.gear}`)
    console.log(`恢复决策: ${options.decision.action} (${options.decision.reason})`)
    console.log(`置信度: ${options.decision.confidence}`)

    // 应用恢复决策
    this.gearBox.applyRecoveryDecision(options.decision)
    const finalState = this.gearBox.getState()

    // 分析结果
    const gearChanged = finalState.gear !== initialState.gear
    const gearChangeDirection = gearChanged
      ? (finalState.gear > initialState.gear ? 'up' : 'down')
      : 'same'

    let expectedBehavior = ''
    switch (options.decision.action) {
      case 'retry':
        expectedBehavior = gearChanged ? '降档以保守重试' : '保持档位重试'
        break
      case 'replan':
        expectedBehavior = gearChanged ? '升档以重新规划' : '保持档位重新规划'
        break
      case 'rollback':
        expectedBehavior = gearChanged ? '降档以安全回滚' : '保持档位回滚'
        break
      case 'ask-human':
        expectedBehavior = '保持档位等待人工介入'
        break
      case 'abort':
        expectedBehavior = '保持档位准备终止'
        break
    }

    console.log(`最终档位: ${finalState.gear}`)
    console.log(`档位变化: ${gearChanged ? '是' : '否'} (${gearChangeDirection})`)
    console.log(`预期行为: ${expectedBehavior}`)

    return {
      scenario: 'recovery-decision-application',
      initialState,
      decision: options.decision,
      finalState,
      analysis: {
        gearChanged,
        gearChangeDirection,
        expectedBehavior
      }
    }
  }

  /**
   * 模拟完整恢复流程
   */
  simulateCompleteRecoveryFlow(options: {
    failureSequence: Array<{
      toolName: string
      isError: boolean
      errorMessage?: string
    }>
    recoveryDecisions: RecoveryDecision[]
    description: string
  }): {
    scenario: string
    flowSteps: Array<{
      step: number
      toolResult: any
      gearBefore: number
      gearAfter: number
      recoveryDecision?: RecoveryDecision
    }>
    analysis: {
      totalSteps: number
      errorSteps: number
      recoverySteps: number
      finalGear: number
      gearChanges: number
    }
  } {
    console.log(`\n=== 完整恢复流程模拟: ${options.description} ===`)
    console.log(`步骤数量: ${options.failureSequence.length}`)
    console.log(`恢复决策数量: ${options.recoveryDecisions.length}`)

    const flowSteps = []
    let recoveryIndex = 0

    // 重置gear-box
    this.gearBox.reportSuccess()

    for (let i = 0; i < options.failureSequence.length; i++) {
      const step = options.failureSequence[i]
      const gearBefore = this.gearBox.getGear()

      // 模拟工具结果
      const toolResult = {
        toolUseId: `step-${i + 1}`,
        content: step.isError ? step.errorMessage || '工具执行失败' : '工具执行成功',
        isError: step.isError
      }

      this.gearBox.reportToolResult(toolResult, step.toolName)
      const gearAfter = this.gearBox.getGear()

      let recoveryDecision: RecoveryDecision | undefined

      // 如果是错误步骤且有恢复决策，应用恢复决策
      if (step.isError && recoveryIndex < options.recoveryDecisions.length) {
        recoveryDecision = options.recoveryDecisions[recoveryIndex]
        this.gearBox.applyRecoveryDecision(recoveryDecision)
        recoveryIndex++
      }

      flowSteps.push({
        step: i + 1,
        toolResult,
        gearBefore,
        gearAfter,
        recoveryDecision
      })

      console.log(`步骤 ${i + 1}: ${step.toolName} ${step.isError ? '失败' : '成功'}, 档位 ${gearBefore}→${gearAfter}`)
      if (recoveryDecision) {
        console.log(`  恢复决策: ${recoveryDecision.action} (${recoveryDecision.reason})`)
      }
    }

    // 分析结果
    const errorSteps = options.failureSequence.filter(s => s.isError).length
    const recoverySteps = options.recoveryDecisions.length
    const finalGear = this.gearBox.getGear()
    const gearChanges = flowSteps.filter(s => s.gearBefore !== s.gearAfter).length

    console.log(`\n流程分析:`)
    console.log(`总步骤: ${flowSteps.length}`)
    console.log(`错误步骤: ${errorSteps}`)
    console.log(`恢复步骤: ${recoverySteps}`)
    console.log(`最终档位: ${finalGear}`)
    console.log(`档位变化次数: ${gearChanges}`)

    return {
      scenario: 'complete-recovery-flow',
      flowSteps,
      analysis: {
        totalSteps: flowSteps.length,
        errorSteps,
        recoverySteps,
        finalGear,
        gearChanges
      }
    }
  }

  /**
   * 运行测试套件
   */
  runTestSuite() {
    console.log('🔄 开始 Gear Box Recovery V1 测试套件\n')

    const results = []

    // 测试1: 不同恢复决策对档位的影响
    console.log('📋 测试1: 恢复决策档位影响测试')
    results.push(this.simulateRecoveryDecisionApplication({
      initialGear: 2,
      decision: {
        action: 'retry',
        reason: 'tool-failure',
        confidence: 0.8
      },
      description: '高置信度retry决策'
    }))

    results.push(this.simulateRecoveryDecisionApplication({
      initialGear: 1,
      decision: {
        action: 'replan',
        reason: 'context-insufficiency',
        confidence: 0.6
      },
      description: '上下文不足replan决策'
    }))

    results.push(this.simulateRecoveryDecisionApplication({
      initialGear: 3,
      decision: {
        action: 'rollback',
        reason: 'verify-failure',
        confidence: 0.9
      },
      description: '验证失败rollback决策'
    }))

    // 测试2: 完整恢复流程
    console.log('\n📋 测试2: 完整恢复流程测试')
    results.push(this.simulateCompleteRecoveryFlow({
      failureSequence: [
        { toolName: 'Bash', isError: true, errorMessage: '编译失败' },
        { toolName: 'Bash', isError: true, errorMessage: '测试失败' },
        { toolName: 'Edit', isError: false },
        { toolName: 'Bash', isError: true, errorMessage: '部署失败' },
        { toolName: 'Bash', isError: false }
      ],
      recoveryDecisions: [
        { action: 'retry', reason: 'tool-failure', confidence: 0.7 },
        { action: 'replan', reason: 'tool-failure', confidence: 0.5 },
        { action: 'rollback', reason: 'tool-failure', confidence: 0.8 }
      ],
      description: '典型CI/CD失败恢复流程'
    }))

    // 汇总分析
    console.log('\n📊 测试套件汇总分析:')
    console.log(`总测试场景: ${results.length}`)

    const gearChangeStats = {
      up: 0,
      down: 0,
      same: 0
    }

    for (const result of results) {
      if (result.scenario === 'recovery-decision-application') {
        gearChangeStats[result.analysis.gearChangeDirection]++
      }
    }

    console.log('\n档位变化统计:')
    console.log(`升档: ${gearChangeStats.up}次`)
    console.log(`降档: ${gearChangeStats.down}次`)
    console.log(`不变: ${gearChangeStats.same}次`)

    console.log('\n✅ Gear Box Recovery V1 测试套件完成')
    return results
  }

  /**
   * 辅助方法：重置到指定档位
   */
  private resetToGear(targetGear: 1 | 2 | 3) {
    // 重置到1档
    this.gearBox.reportSuccess()

    // 如果需要升到更高档位，模拟失败
    if (targetGear > 1) {
      const failuresNeeded = targetGear === 2 ? 4 : 6
      for (let i = 0; i < failuresNeeded; i++) {
        this.gearBox.reportToolResult({
          toolUseId: `reset-${i}`,
          content: '模拟失败以升档',
          isError: true
        }, 'Bash')
      }
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const harness = new GearBoxRecoveryV1Harness()
  harness.runTestSuite()
}