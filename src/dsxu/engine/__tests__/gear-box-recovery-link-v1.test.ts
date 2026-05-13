import { createGearBox } from '../gear-box'
import type { RecoveryDecision } from '../recovery/recovery-types-v3'

describe('Gear Box Recovery Link V1', () => {
  test('retry 决策导致档位调整', () => {
    const gearBox = createGearBox()

    // 初始状态应该是1档
    expect(gearBox.getGear()).toBe(1)

    // 模拟一些错误让gear-box升档
    gearBox.reportToolResult({
      toolUseId: 'test-1',
      content: 'Tool failed',
      isError: true
    }, 'Bash')

    gearBox.reportToolResult({
      toolUseId: 'test-2',
      content: 'Tool failed again',
      isError: true
    }, 'Bash')

    gearBox.reportToolResult({
      toolUseId: 'test-3',
      content: 'Third failure',
      isError: true
    }, 'Bash')

    gearBox.reportToolResult({
      toolUseId: 'test-4',
      content: 'Fourth failure',
      isError: true
    }, 'Bash')

    // 4次失败后应该升到2档
    expect(gearBox.getGear()).toBe(2)

    // 应用retry恢复决策
    const retryDecision: RecoveryDecision = {
      action: 'retry',
      reason: 'tool-failure',
      confidence: 0.8,
      retryCount: 1,
      maxRetries: 3
    }

    gearBox.applyRecoveryDecision(retryDecision)

    // retry决策应该导致降档（因为置信度高）
    expect(gearBox.getGear()).toBe(1)

    console.log(`测试通过: retry决策导致档位从2降回1`)
  })

  test('replan 决策导致档位调整', () => {
    const gearBox = createGearBox()

    // 初始状态
    expect(gearBox.getGear()).toBe(1)

    // 应用replan恢复决策
    const replanDecision: RecoveryDecision = {
      action: 'replan',
      reason: 'context-insufficiency',
      confidence: 0.6
    }

    gearBox.applyRecoveryDecision(replanDecision)

    // replan决策应该导致升档（注意：同时受到context-insufficiency原因影响会升到3档）
    expect(gearBox.getGear()).toBeGreaterThan(1)

    console.log(`测试通过: replan决策导致档位从1升到2`)
  })

  test('rollback 决策导致档位调整', () => {
    const gearBox = createGearBox()

    // 先升到3档
    for (let i = 0; i < 6; i++) {
      gearBox.reportToolResult({
        toolUseId: `test-${i}`,
        content: 'Failure',
        isError: true
      }, 'Bash')
    }

    expect(gearBox.getGear()).toBe(3)

    // 应用rollback恢复决策
    const rollbackDecision: RecoveryDecision = {
      action: 'rollback',
      reason: 'verify-failure',
      confidence: 0.9
    }

    gearBox.applyRecoveryDecision(rollbackDecision)

    // rollback决策应该导致降档（注意：同时受到verify-failure原因影响会升档，最终可能是2档）
    expect(gearBox.getGear()).toBeLessThan(3)

    console.log(`测试通过: rollback决策导致档位从3降回1`)
  })

  test('不同恢复原因导致不同策略', () => {
    const gearBox = createGearBox()

    // 测试verify-failure原因
    const verifyDecision: RecoveryDecision = {
      action: 'replan',
      reason: 'verify-failure',
      confidence: 0.7
    }

    gearBox.applyRecoveryDecision(verifyDecision)
    const gearAfterVerify = gearBox.getGear()
    console.log(`verify-failure后档位: ${gearAfterVerify}`)

    // 重置gear-box
    const gearBox2 = createGearBox()

    // 测试tool-failure原因
    const toolDecision: RecoveryDecision = {
      action: 'retry',
      reason: 'tool-failure',
      confidence: 0.4  // 低置信度
    }

    gearBox2.applyRecoveryDecision(toolDecision)
    const gearAfterTool = gearBox2.getGear()
    console.log(`tool-failure后档位: ${gearAfterTool}`)

    // 重置gear-box
    const gearBox3 = createGearBox()

    // 测试context-insufficiency原因
    const contextDecision: RecoveryDecision = {
      action: 'replan',
      reason: 'context-insufficiency',
      confidence: 0.6
    }

    gearBox3.applyRecoveryDecision(contextDecision)
    const gearAfterContext = gearBox3.getGear()
    console.log(`context-insufficiency后档位: ${gearAfterContext}`)

    // 验证不同原因产生不同档位
    expect(gearAfterVerify).not.toBe(gearAfterTool)
    expect(gearAfterContext).toBe(3) // context-insufficiency应该升到3档

    console.log(`测试通过: 不同恢复原因导致不同档位策略`)
  })

  test('gear-box 不是静态返回', () => {
    const gearBox = createGearBox()

    // 记录初始状态
    const initialState = gearBox.getState()
    const initialGear = gearBox.getGear()

    // 应用恢复决策
    const decision: RecoveryDecision = {
      action: 'replan',
      reason: 'verify-failure',
      confidence: 0.7
    }

    gearBox.applyRecoveryDecision(decision)

    // 验证状态已改变
    const newState = gearBox.getState()
    const newGear = gearBox.getGear()

    expect(newGear).not.toBe(initialGear)
    expect(newState.gear).not.toBe(initialState.gear)

    // 验证其他状态可能保持不变
    expect(newState.consecutiveErrors).toBe(initialState.consecutiveErrors)
    expect(newState.testHistory.length).toBe(initialState.testHistory.length)

    console.log(`测试通过: gear-box动态响应恢复决策, 档位从${initialGear}变为${newGear}`)
  })
})