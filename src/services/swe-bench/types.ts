/**
 * R5-28: SWE-bench runner 类型定义
 *
 * SWE-bench 是评估AI代码助手在真实软件工程任务上的基准测试
 * 每个任务包含：问题描述、代码库、测试套件、评估标准
 */

export interface SWEBenchTask {
  /** 任务ID，如 "swe-bench-001" */
  id: string;

  /** 任务标题，通常是GitHub issue标题 */
  title: string;

  /** 问题描述，包含需要修复的bug或功能需求 */
  description: string;

  /** 代码库信息 */
  repository: {
    /** 仓库URL或本地路径 */
    url: string;
    /** 提交哈希 */
    commit: string;
    /** 分支 */
    branch: string;
  };

  /** 测试套件配置 */
  testSuite: {
    /** 测试命令，如 "pytest tests/" */
    command: string;
    /** 测试超时时间（毫秒） */
    timeout: number;
    /** 环境变量 */
    env?: Record<string, string>;
  };

  /** 评估标准 */
  evaluation: {
    /** 是否必须通过所有测试 */
    requireAllTestsPass: boolean;
    /** 允许的最大测试失败数 */
    maxFailures?: number;
    /** 其他评估指标 */
    metrics?: Record<string, number>;
  };

  /** 元数据 */
  metadata: {
    /** 难度等级：easy/medium/hard */
    difficulty: 'easy' | 'medium' | 'hard';
    /** 任务类型：bug-fix/feature/test */
    type: 'bug-fix' | 'feature' | 'test' | 'refactor';
    /** 编程语言 */
    language: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
  };
}

export interface SWEBenchResult {
  /** 任务ID */
  taskId: string;

  /** 执行状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

  /** 测试结果 */
  testResults: {
    /** 总测试数 */
    total: number;
    /** 通过数 */
    passed: number;
    /** 失败数 */
    failed: number;
    /** 跳过数 */
    skipped: number;
    /** 错误数 */
    errors: number;
    /** 测试输出 */
    output: string;
    /** 测试耗时（毫秒） */
    duration: number;
  };

  /** 评估结果 */
  evaluation: {
    /** 是否通过 */
    passed: boolean;
    /** 得分（0-100） */
    score: number;
    /** 失败原因 */
    failureReason?: string;
    /** 详细评估指标 */
    metrics: Record<string, number>;
  };

  /** 执行信息 */
  execution: {
    /** 开始时间 */
    startTime: string;
    /** 结束时间 */
    endTime?: string;
    /** 总耗时（毫秒） */
    duration?: number;
    /** 使用的模型 */
    model?: string;
    /** 使用的配置 */
    config?: Record<string, any>;
  };

  /** 错误信息 */
  error?: {
    /** 错误类型 */
    type: string;
    /** 错误消息 */
    message: string;
    /** 堆栈跟踪 */
    stack?: string;
  };
}

export interface SWEBenchRunnerConfig {
  /** 模型配置 */
  model: {
    /** 模型名称 */
    name: string;
    /** API端点 */
    endpoint: string;
    /** API密钥 */
    apiKey?: string;
    /** 温度 */
    temperature: number;
    /** 最大输出token数 */
    maxTokens: number;
  };

  /** 执行配置 */
  execution: {
    /** 超时时间（毫秒） */
    timeout: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 工作目录 */
    workingDir: string;
    /** 是否启用沙盒 */
    sandbox: boolean;
  };

  /** 评估配置 */
  evaluation: {
    /** 通过阈值（0-100） */
    passThreshold: number;
    /** 是否启用详细日志 */
    verbose: boolean;
    /** 输出目录 */
    outputDir: string;
  };
}

export interface SWEBenchRunOptions {
  /** 任务ID或任务对象 */
  task: string | SWEBenchTask;

  /** 自定义配置 */
  config?: Partial<SWEBenchRunnerConfig>;

  /** 回调函数 */
  onProgress?: (progress: {
    status: string;
    progress: number;
    message: string;
    result?: Partial<SWEBenchResult>;
  }) => void;

  /** 是否异步执行 */
  async?: boolean;
}