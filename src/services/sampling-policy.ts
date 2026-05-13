/**
 * R5-20: Per-turn sampling 策略器
 *
 * 目标：根据任务类型动态选择 temperature/top_p/model
 * 接入点：QueryEngine.ts 的 getMainLoopModel() 周边
 *
 * 7种任务类型及其采样策略：
 * 1. 代码生成/修复：temperature=0.7, top_p=0.95, model=deepseek-v4-flash
 * 2. 复杂推理/规划：temperature=0.3, top_p=0.9, model=deepseek-v4-flash thinking max
 * 3. 工具调用密集型：temperature=0.5, top_p=0.95, model=deepseek-v4-flash
 * 4. 创意写作：temperature=0.9, top_p=0.99, model=deepseek-v4-flash
 * 5. 事实问答：temperature=0.2, top_p=0.85, model=deepseek-v4-flash
 * 6. 调试/错误分析：temperature=0.4, top_p=0.9, model=deepseek-v4-flash thinking max
 * 7. 默认/未知：temperature=0.5, top_p=0.95, model=deepseek-v4-flash
 */

import {
  decideDeepSeekV4Route,
  formatDeepSeekV4ModelEvidence,
  type DeepSeekV4Model,
  type DeepSeekV4PolicyReason,
  type DeepSeekV4RouteInput,
} from '../utils/model/deepseekV4Control'

export interface SamplingConfig {
  temperature: number;
  top_p: number;
  model: DeepSeekV4Model;
  routeReason: DeepSeekV4PolicyReason;
  maxTokens: number;
  modelEvidence: string;
}

export type TaskType =
  | 'code-generation'
  | 'complex-reasoning'
  | 'tool-intensive'
  | 'creative-writing'
  | 'factual-qa'
  | 'debugging'
  | 'default';

export interface TaskClassification {
  type: TaskType;
  confidence: number; // 0-1
  features: Record<string, number>; // 特征向量
}

/**
 * 采样策略配置
 */
function createSamplingConfig(
  base: { temperature: number; top_p: number },
  routeInput: DeepSeekV4RouteInput,
): SamplingConfig {
  const decision = decideDeepSeekV4Route(routeInput)
  return {
    ...base,
    model: decision.model,
    routeReason: decision.reason,
    maxTokens: decision.maxTokens,
    modelEvidence: formatDeepSeekV4ModelEvidence(decision),
  }
}

const SAMPLING_STRATEGIES: Record<TaskType, SamplingConfig> = {
  'code-generation': createSamplingConfig(
    { temperature: 0.7, top_p: 0.95 },
    { workflowKind: 'feature', role: 'coder' },
  ),
  'complex-reasoning': createSamplingConfig(
    { temperature: 0.3, top_p: 0.9 },
    { workflowKind: 'planning', role: 'planner' },
  ),
  'tool-intensive': createSamplingConfig(
    { temperature: 0.5, top_p: 0.95 },
    { workflowKind: 'bugfix', role: 'coder' },
  ),
  'creative-writing': createSamplingConfig(
    { temperature: 0.9, top_p: 0.99 },
    { workflowKind: 'generic_chat', latencySensitive: true },
  ),
  'factual-qa': createSamplingConfig(
    { temperature: 0.2, top_p: 0.85 },
    { workflowKind: 'generic_chat', forceNonThinkingJson: true },
  ),
  'debugging': createSamplingConfig(
    { temperature: 0.4, top_p: 0.9 },
    { workflowKind: 'recovery', role: 'recovery' },
  ),
  'default': createSamplingConfig(
    { temperature: 0.5, top_p: 0.95 },
    { workflowKind: 'generic_chat' },
  ),
};

/**
 * 任务分类器
 * 根据消息内容、工具使用情况、历史上下文等特征分类任务
 */
export class TaskClassifier {
  /**
   * 分析消息并分类任务类型
   */
  classify(messages: any[], tools?: any[]): TaskClassification {
    // 提取最新用户消息
    const latestUserMessage = this.getLatestUserMessage(messages);
    if (!latestUserMessage) {
      return this.createClassification('default', 0.5, {});
    }

    const content = this.extractTextContent(latestUserMessage);
    const features = this.extractFeatures(content, messages, tools);

    // 基于特征进行分类
    const classification = this.classifyByFeatures(features);
    return classification;
  }

  /**
   * 获取最新的用户消息
   */
  private getLatestUserMessage(messages: any[]): any | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }
    return null;
  }

  /**
   * 提取文本内容
   */
  private extractTextContent(message: any): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      // 提取所有文本块
      return message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text || '')
        .join('\n');
    }
    return '';
  }

  /**
   * 提取特征向量
   */
  private extractFeatures(content: string, messages: any[], tools?: any[]): Record<string, number> {
    const features: Record<string, number> = {};

    // 1. 代码相关特征
    features.hasCodeBlocks = this.hasCodeBlocks(content) ? 1 : 0;
    features.codeKeywords = this.countKeywords(content, [
      'function', 'class', 'def ', 'import', 'export', 'const', 'let', 'var',
      'if ', 'for ', 'while ', 'return', 'console.log', 'print', 'debug',
      'code', 'program', 'algorithm', 'software', 'develop', 'implement'
    ]);

    // 2. 推理相关特征
    features.reasoningKeywords = this.countKeywords(content, [
      'think step by step', 'reason', 'analyze', 'plan', 'strategy', 'approach',
      'first', 'then', 'finally', 'therefore', 'because', 'solution', 'solve'
    ]);

    // 3. 工具相关特征
    features.hasTools = tools && tools.length > 0 ? 1 : 0;
    features.toolCount = tools ? tools.length : 0;

    // 4. 创意相关特征
    features.creativeKeywords = this.countKeywords(content, [
      'write a', 'story', 'poem', 'essay', 'fiction', 'novel', 'tale',
      'imagine', 'creative', 'original', 'narrative', 'fantasy', 'plot'
    ]);

    // 5. 事实相关特征
    features.factualKeywords = this.countKeywords(content, [
      'what is', 'what are', 'what year', 'what time', 'what date',
      'when was', 'where is', 'who is',
      'explain', 'define', 'describe', 'list', 'compare', 'name the'
    ]);

    // 6. 调试相关特征
    features.debugKeywords = this.countKeywords(content, [
      'error', 'bug', 'fix', 'debug', 'issue', 'problem',
      'crash', 'exception', 'stack trace', 'log', 'broken', 'not working', 'fail'
    ]);

    // 7. 上下文特征
    features.messageLength = Math.min(content.length / 1000, 1); // 归一化到 0-1
    features.hasHistory = messages.length > 2 ? 1 : 0;

    return features;
  }

  /**
   * 检查是否包含代码块
   */
  private hasCodeBlocks(content: string): boolean {
    return content.includes('```') ||
           content.includes('function') ||
           content.includes('class ') ||
           content.includes('def ');
  }

  /**
   * 统计关键词出现次数（归一化）
   */
  private countKeywords(content: string, keywords: string[]): number {
    const lowerContent = content.toLowerCase();
    let count = 0;
    for (const keyword of keywords) {
      // 对于多词关键词，使用 includes
      if (keyword.includes(' ')) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          count += 2; // 多词关键词权重更高
        }
      } else {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
        const matches = lowerContent.match(regex);
        if (matches) {
          count += matches.length;
        }
      }
    }
    // 使用更宽松的归一化：每出现一个关键词得0.3分，最高1.0
    return Math.min(count * 0.3, 1);
  }

  /**
   * 基于特征分类
   * 使用优先级规则：某些特征具有决定性
   */
  private classifyByFeatures(features: Record<string, number>): TaskClassification {
    // 规则1: 如果有代码块，很可能是代码生成或调试
    if (features.hasCodeBlocks > 0) {
      if (features.debugKeywords > 0.2) {
        return this.createClassification('debugging', 0.8, features);
      }
      return this.createClassification('code-generation', 0.9, features);
    }

    // 规则2: 如果有工具，很可能是工具密集型
    if (features.hasTools > 0 && features.toolCount > 0) {
      return this.createClassification('tool-intensive', 0.8, features);
    }

    // 规则3: 事实特征（优先级提高）
    if (features.factualKeywords > 0.1) {
      return this.createClassification('factual-qa', 0.7, features);
    }

    // 规则4: 推理特征
    if (features.reasoningKeywords > 0.2) {
      return this.createClassification('complex-reasoning', 0.7, features);
    }

    // 规则5: 创意特征
    if (features.creativeKeywords > 0.3) {
      return this.createClassification('creative-writing', 0.8, features);
    }

    // 规则6: 调试特征
    if (features.debugKeywords > 0.3) {
      return this.createClassification('debugging', 0.7, features);
    }

    // 规则7: 代码关键词（即使没有代码块）
    if (features.codeKeywords > 0.3) {
      return this.createClassification('code-generation', 0.6, features);
    }

    // 规则8: 默认
    return this.createClassification('default', 0.5, features);
  }

  private createClassification(
    type: TaskType,
    confidence: number,
    features: Record<string, number>
  ): TaskClassification {
    return {
      type,
      confidence: Math.min(Math.max(confidence, 0), 1),
      features
    };
  }
}

/**
 * 采样策略器
 */
export class SamplingPolicy {
  private classifier: TaskClassifier;

  constructor() {
    this.classifier = new TaskClassifier();
  }

  /**
   * 根据消息决定采样配置
   */
  getSamplingConfig(messages: any[], tools?: any[]): SamplingConfig {
    const classification = this.classifier.classify(messages, tools);

    // 获取对应策略
    const config = SAMPLING_STRATEGIES[classification.type];

    // 记录决策日志（生产环境可改为 OTEL）
    this.logDecision(classification, config);

    return config;
  }

  /**
   * 直接根据任务类型获取采样配置
   */
  getConfigForTaskType(taskType: TaskType): SamplingConfig {
    return SAMPLING_STRATEGIES[taskType];
  }

  /**
   * 记录决策日志
   */
  private logDecision(classification: TaskClassification, config: SamplingConfig): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[SamplingPolicy]', {
        taskType: classification.type,
        confidence: classification.confidence.toFixed(2),
        temperature: config.temperature,
        top_p: config.top_p,
        model: config.model
      });
    }
  }

  /**
   * 获取所有可用策略
   */
  getAllStrategies(): Record<TaskType, SamplingConfig> {
    return { ...SAMPLING_STRATEGIES };
  }
}

// 默认导出单例
export const samplingPolicy = new SamplingPolicy();
