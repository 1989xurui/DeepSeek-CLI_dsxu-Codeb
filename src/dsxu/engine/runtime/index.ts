/**
 * DUXU Runtime Core - 主入口
 *
 * 统一导出Session/Task/Persist接口
 */

// Session 模型
export {
  createSession,
  updateSession,
  validateSession,
  type Session,
  type SessionStatus,
  type SessionFilter,
  type CreateSessionParams,
  type UpdateSessionParams
} from './session/model'

// Task 模型
export {
  createTask,
  updateTask,
  createTaskResult,
  createTaskError,
  createResumePoint,
  validateTask,
  type Task,
  type TaskStatus,
  type TaskResult,
  type TaskError,
  type ResumePoint,
  type TaskFilter,
  type CreateTaskParams,
  type UpdateTaskParams
} from './task/model'

// Task Runner
export {
  TaskRunner,
  type TaskRunnerConfig,
  type TaskExecutionContext,
  type TaskHandler
} from './task/runner'

// Persist 适配器
export {
  createPersistAdapter,
  type PersistAdapter,
  type PersistConfig
} from './persist/adapter'

import { DEFAULT_PERSIST_CONFIG } from './persist/adapter'

// 文件系统适配器
export {
  FileSystemPersistAdapter
} from './persist/filesystem-adapter'

// 内存适配器
export {
  MemoryPersistAdapter
} from './persist/memory-adapter'

/**
 * 创建默认的Runtime Core实例
 */
export function createRuntimeCore(config?: Partial<PersistConfig>) {
  const persistConfig: PersistConfig = {
    ...DEFAULT_PERSIST_CONFIG,
    ...config
  }

  const persistAdapter = createPersistAdapter(persistConfig)
  const taskRunner = new TaskRunner(persistAdapter)

  return {
    persist: persistAdapter,
    taskRunner,

    async initialize() {
      await persistAdapter.initialize()
      console.log('Runtime Core 已初始化')
    },

    async cleanup() {
      await taskRunner.stopAllTasks()
      console.log('Runtime Core 已清理')
    }
  }
}