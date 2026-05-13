/**
 * Memory System - 记忆系统
 *
 * 统一导出所有记忆相关模块：
 * 1. Memory System - 完整记忆系统实现
 * 2. Memory Pipeline - 记忆处理流水线
 * 3. Memory Registry - 记忆注册表
 * 4. Memory Extractor - 记忆提取器
 * 5. Episode Memory - Episode记忆
 * 6. Memory Search - 记忆搜索
 */

// 导出Memory System
export * from './memory-system'

// 导出Memory Pipeline
export * from '../memory-pipeline'

// 导出Memory Registry
export * from './memory-registry'

// 导出Memory Extractor
export * from './memory-extractor'

// 导出Episode Memory
export * from './episode-memory'

// 导出Memory Search
export * from './memory-search'

// 导出类型定义
export type {
  Memory,
  MemoryType,
  MemoryRecord,
  MemoryMetadata,
  MemorySearchResult,
  MemorySearchOptions,
  PipelineConfig,
  PipelineResult,
  CompactResult,
  BriefResult,
  ClassifyResult,
  Episode,
  EpisodeEvent,
  EpisodeOutcome,
  MemorySystem,
  MemorySystemOptions,
  StorageQuery,
  StorageBatchOperation,
  StorageStats,
  ExtractionContext,
} from './types'

// 工具函数
export {
  createDefaultMemoryPipeline,
  getDefaultMemoryRegistry,
  createMemoryExtractor,
  createEpisodeMemory,
  createMemorySearch,
} from './utils'