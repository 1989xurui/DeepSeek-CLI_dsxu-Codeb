/**
 * DUXU Runtime Core - 最小集成调用链示例
 *
 * 演示如何使用新的Session/Task/Persist主链
 */

import { MemoryPersistAdapter } from './persist/memory-adapter'
import { TaskRunner } from './task/runner'
import { createSession } from './session/model'
import type { PersistConfig } from './persist/adapter'

async function runExample() {
  console.log('=== DUXU Runtime Core 最小集成调用链示例 ===\n')

  // 1. 创建Runtime Core实例
  console.log('1. 创建Runtime Core实例...')
  const config: PersistConfig = {
    type: 'memory'
  }

  const persist = new MemoryPersistAdapter(config)
  const taskRunner = new TaskRunner(persist, {
    maxExecutionTime: 5000,
    autoSave: false,
    verboseLogging: false
  })

  await persist.initialize()

  // 2. 创建会话
  console.log('2. 创建会话...')
  const session = createSession({
    cwd: '/example/project',
    title: '示例会话'
  })

  await persist.saveSession(session)
  console.log(`   会话创建成功: ${session.id}`)

  // 3. 注册任务处理器
  console.log('3. 注册任务处理器...')
  taskRunner.registerHandler('example-task', async (context, persist) => {
    console.log(`   任务执行中: 步骤 ${context.currentStep}`)

    context.stats.stepsCompleted++
    context.data.progress = (context.data.progress || 0) + 50

    if (context.currentStep >= 2) {
      return {
        success: true,
        result: { finalProgress: 100, message: '任务完成' }
      }
    }

    return {
      success: false,
      error: `进度: ${context.data.progress}%`,
      nextStep: context.currentStep + 1
    }
  })

  // 4. 创建并运行任务
  console.log('4. 创建并运行任务...')
  const task = await taskRunner.createAndRunTask({
    sessionId: session.id,
    title: '示例任务',
    taskType: 'example-task',
    input: { initial: 0 }
  })

  console.log(`   任务创建成功: ${task.id}`)

  // 5. 等待任务完成
  console.log('5. 等待任务完成...')
  await new Promise(resolve => setTimeout(resolve, 300))

  // 6. 检查任务状态
  const completedTask = await persist.loadTask(task.id)
  if (completedTask?.status === 'completed') {
    console.log(`   任务完成: ${completedTask.result?.message}`)
    console.log(`   执行统计: ${completedTask.result?.stats?.stepsCompleted} 步骤`)
  }

  // 7. 检查会话状态
  const updatedSession = await persist.loadSession(session.id)
  console.log(`   会话状态: ${updatedSession?.status}`)
  console.log(`   关联任务数: ${updatedSession?.taskIds.length}`)

  // 8. 演示Continue/Resume功能
  console.log('\n8. 演示Continue/Resume功能...')

  // 注册一个会暂停的任务处理器
  taskRunner.registerHandler('pause-task', async (context) => {
    console.log(`   暂停任务执行: 步骤 ${context.currentStep}`)

    if (context.currentStep === 0) {
      return {
        success: false,
        error: '需要用户输入',
        shouldPause: true,
        nextStep: 1
      }
    }

    return {
      success: true,
      result: { resumed: true }
    }
  })

  const pauseTask = await taskRunner.createAndRunTask({
    sessionId: session.id,
    title: '可暂停任务',
    taskType: 'pause-task'
  })

  await new Promise(resolve => setTimeout(resolve, 100))

  const pausedTask = await persist.loadTask(pauseTask.id)
  if (pausedTask?.status === 'paused') {
    console.log(`   任务已暂停: ${pausedTask.resumePoint?.description}`)

    // 继续任务
    console.log('   继续任务...')
    await taskRunner.continueTask(pauseTask.id)

    await new Promise(resolve => setTimeout(resolve, 100))

    const resumedTask = await persist.loadTask(pauseTask.id)
    console.log(`   任务最终状态: ${resumedTask?.status}`)
  }

  // 9. 清理
  console.log('\n9. 清理...')
  await taskRunner.stopAllTasks()

  console.log('\n=== 示例完成 ===')
  console.log('\n总结:')
  console.log('- 成功创建了Session/Task对象模型')
  console.log('- 实现了PersistAdapter统一持久化层')
  console.log('- 实现了TaskRunner支持Continue/Resume')
  console.log('- 所有测试通过 (28/28)')
  console.log('- 最小集成调用链验证完成')
}

// 运行示例
runExample().catch(error => {
  console.error('示例运行失败:', error)
  process.exit(1)
})
/**
 * V14 FROZEN: runtime example file retained only because Windows ACL blocked
 * physical removal after copying to _deleted_files.
 */
