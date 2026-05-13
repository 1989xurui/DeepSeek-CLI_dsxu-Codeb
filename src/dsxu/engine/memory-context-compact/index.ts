/**
 * V14 FROZEN: this legacy aggregation layer is replaced by DSXU control-plane
 * modules (`context-discipline-control` and `memory-refill-control`). The file
 * is retained only because Windows ACL blocked physical removal.
 *
 * Memory/Context/Compact 统一承接层
 *
 * V8-2 Runtime Core: 统一管理记忆、上下文和压缩功能
 */

// ── Unified Memory Manager ──
export * from '../memory/unified-memory-manager'
export type {
  UnifiedMemoryConfig,
  MemoryProcessingContext,
  UnifiedMemoryStats,
  MemoryLayerStatus
} from '../memory/unified-memory-manager'

// ── Compact Pipeline ──
export * from '../compact/compact-pipeline'
export type {
  CompactPipelineConfig,
  BriefResult,
  ClassifyResult,
  CompactPipelineResult
} from '../compact/compact-pipeline'

// ── Brief Generator ──
export * from '../brief/brief-generator'
export type {
  BriefConfig,
  BriefResult as BriefGeneratorResult,
  BriefContext
} from '../brief/brief-generator'

// ── Classifier ──
export * from '../classify/classifier'
export type {
  ClassifierConfig,
  ClassificationResult,
  ClassificationContext
} from '../classify/classifier'

// ── 工厂函数 ──

/**
 * 创建完整的Memory/Context/Compact运行时
 */
export function createMemoryContextCompactRuntime(options?: {
  memoryConfig?: Partial<UnifiedMemoryConfig>
  compactConfig?: Partial<CompactPipelineConfig>
  briefConfig?: Partial<BriefConfig>
  classifyConfig?: Partial<ClassifierConfig>
}) {
  const memoryManager = createUnifiedMemoryManager(options?.memoryConfig)
  const compactPipeline = createCompactPipeline(options?.compactConfig)
  const briefGenerator = createBriefGenerator(options?.briefConfig)
  const classifier = createClassifier(options?.classifyConfig)

  return {
    memoryManager,
    compactPipeline,
    briefGenerator,
    classifier,

    /**
     * 设置LLM调用函数（统一设置）
     */
    setLLMCallFn(llmCall: any) {
      memoryManager.setLLMCallFn(llmCall)
      compactPipeline.setLLMCallFn(llmCall)
      briefGenerator.setLLMCallFn(llmCall)
      classifier.setLLMCallFn(llmCall)
    },

    /**
     * 处理消息（统一入口）
     */
    async processMessages(
      messages: any[],
      context: {
        sessionId: string
        taskId?: string
        cwd: string
        query?: string
      }
    ) {
      // 1. 使用Memory Manager处理
      const memoryResult = await memoryManager.processMessages(messages, {
        sessionId: context.sessionId,
        taskId: context.taskId,
        cwd: context.cwd,
        query: context.query
      })

      // 2. 使用Compact Pipeline处理
      const compactResult = await compactPipeline.execute(memoryResult.processedMessages, context)

      // 3. 如果需要，生成摘要
      let briefResult
      if (briefGenerator.shouldGenerateBrief(messages, 'compact')) {
        briefResult = await briefGenerator.generate(messages, {
          sessionId: context.sessionId,
          taskId: context.taskId,
          cwd: context.cwd,
          query: context.query
        })
      }

      // 4. 如果需要，进行分类
      let classificationResult
      if (classifier.getConfig().enabled) {
        classificationResult = await classifier.classify(messages, {
          sessionId: context.sessionId,
          taskId: context.taskId,
          cwd: context.cwd,
          query: context.query
        })
      }

      return {
        processedMessages: compactResult.compaction.messages,
        memory: {
          extractedMemories: memoryResult.extractedMemories,
          episode: memoryResult.episode
        },
        compact: compactResult,
        brief: briefResult,
        classification: classificationResult
      }
    },

    /**
     * 获取运行时状态
     */
    getStatus() {
      return {
        memory: memoryManager.getComponentStatus(),
        compact: {
          enabled: compactPipeline.getConfig().enabled,
          lastCompactTime: 0 // 需要从compactPipeline中获取
        },
        brief: {
          enabled: briefGenerator.getConfig().enabled,
          config: briefGenerator.getConfig()
        },
        classify: {
          enabled: classifier.getConfig().enabled,
          config: classifier.getConfig()
        }
      }
    },

    /**
     * 清理资源
     */
    async cleanup() {
      await memoryManager.cleanup()
      // compactPipeline, briefGenerator, classifier 通常不需要清理
    }
  }
}

/**
 * 创建默认的Memory/Context/Compact运行时
 */
export function createDefaultMemoryContextCompactRuntime() {
  return createMemoryContextCompactRuntime()
}

// ── 类型导出 ──
export type MemoryContextCompactRuntime = ReturnType<typeof createMemoryContextCompactRuntime>
