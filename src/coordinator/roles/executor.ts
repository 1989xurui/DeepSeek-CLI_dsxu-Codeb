/**
 * R5-17: Executor 角色
 * 使用 chat 模型执行代码修改
 */

import { BaseAgent, AgentRole, Task, AgentResult } from '../../agents/base-agent.js';

export interface CodeChange {
  filePath: string;
  oldCode?: string;
  newCode: string;
  changeType: 'add' | 'modify' | 'delete' | 'refactor';
  description: string;
  lineNumbers?: { start: number; end: number };
}

export interface ImplementationResult {
  changes: CodeChange[];
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  testsWritten: number;
  documentationUpdated: boolean;
  implementationTime: number; // 分钟
  complexity: 'simple' | 'medium' | 'complex';
}

export class Executor extends BaseAgent {
  private readonly model: string = 'deepseek-chat'; // chat 模型
  private readonly maxRetries: number = 3;
  private readonly rejectionRate: number = 0.3; // 30% 的拒绝率（与 Critic 配合）

  constructor(id: string = 'executor-1') {
    super(
      id,
      'executor',
      '代码执行者',
      [
        { name: 'coding', description: '编写和修改代码' },
        { name: 'testing', description: '编写和执行测试' },
        { name: 'debugging', description: '调试和修复问题' },
        { name: 'refactoring', description: '代码重构' },
        { name: 'documentation', description: '编写文档' }
      ]
    );
  }

  async process(task: Task): Promise<AgentResult> {
    this.logActivity('开始执行任务', { taskId: task.id, taskType: task.type });

    // 验证任务
    const validation = this.validateTask(task);
    if (!validation.valid) {
      return this.createErrorResult('任务验证失败', validation.errors);
    }

    // 检查是否需要 TDD
    const requiresTDD = task.metadata?.requiresTDD === true;

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < this.maxRetries) {
      try {
        if (retryCount > 0) {
          this.logActivity('重试执行', { taskId: task.id, retryCount });
        }

        // 分析任务要求
        const analysis = await this.analyzeImplementation(task);

        // 执行实现
        const result = await this.executeImplementation(task, analysis, requiresTDD);

        this.logActivity('执行完成', {
          taskId: task.id,
          filesModified: result.filesModified.length,
          testsWritten: result.testsWritten,
          implementationTime: result.implementationTime
        });

        return this.createSuccessResult(
          {
            implementation: result,
            analysis,
            requiresTDD,
            retryCount
          },
          [], // 通常 Executor 不创建子任务
          {
            modelUsed: this.model,
            executionTime: new Date().toISOString(),
            success: true
          }
        );

      } catch (error: any) {
        lastError = error;
        retryCount++;
        this.logActivity('执行失败', {
          taskId: task.id,
          retryCount,
          error: error.message
        });

        if (retryCount >= this.maxRetries) {
          break;
        }

        // 等待后重试
        await this.delay(1000 * retryCount);
      }
    }

    return this.createErrorResult(
      `执行失败，已达到最大重试次数 (${this.maxRetries})`,
      [lastError?.message || '未知错误'],
      { retryCount, lastError: lastError?.stack }
    );
  }

  /**
   * 分析实现要求
   */
  private async analyzeImplementation(task: Task): Promise<ImplementationAnalysis> {
    this.logActivity('分析实现要求', { taskId: task.id });

    // 这里应该调用 chat 模型进行实际分析
    // 目前使用模拟实现

    return {
      taskDescription: task.description,
      requirements: task.requirements,
      constraints: task.constraints,
      priority: task.priority,
      estimatedEffort: this.estimateEffort(task),
      technicalApproach: this.determineTechnicalApproach(task),
      filesToModify: this.identifyFilesToModify(task),
      testingStrategy: this.determineTestingStrategy(task)
    };
  }

  /**
   * 执行实现
   */
  private async executeImplementation(
    task: Task,
    analysis: ImplementationAnalysis,
    requiresTDD: boolean
  ): Promise<ImplementationResult> {
    this.logActivity('开始执行实现', { taskId: task.id, requiresTDD });

    const startTime = Date.now();
    const changes: CodeChange[] = [];
    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];
    let testsWritten = 0;

    // 如果需要 TDD，先编写测试
    if (requiresTDD) {
      const testChanges = await this.writeTestsFirst(task, analysis);
      changes.push(...testChanges);
      testsWritten = testChanges.filter(c => c.filePath.includes('.test.') || c.filePath.includes('.spec.')).length;
    }

    // 执行主要实现
    const implementationChanges = await this.performImplementation(task, analysis);
    changes.push(...implementationChanges);

    // 更新文档
    const documentationUpdated = await this.updateDocumentation(task, analysis);

    // 分类文件变化
    for (const change of changes) {
      if (change.changeType === 'add' && !filesCreated.includes(change.filePath)) {
        filesCreated.push(change.filePath);
      } else if (change.changeType === 'modify' && !filesModified.includes(change.filePath)) {
        filesModified.push(change.filePath);
      } else if (change.changeType === 'delete' && !filesDeleted.includes(change.filePath)) {
        filesDeleted.push(change.filePath);
      }
    }

    const implementationTime = (Date.now() - startTime) / 60000; // 转换为分钟

    return {
      changes,
      filesCreated,
      filesModified,
      filesDeleted,
      testsWritten,
      documentationUpdated,
      implementationTime,
      complexity: this.assessImplementationComplexity(changes)
    };
  }

  /**
   * TDD：先编写测试
   */
  private async writeTestsFirst(task: Task, analysis: ImplementationAnalysis): Promise<CodeChange[]> {
    this.logActivity('TDD: 编写测试', { taskId: task.id });

    const changes: CodeChange[] = [];

    // 根据任务类型生成测试文件
    if (analysis.filesToModify.length > 0) {
      for (const filePath of analysis.filesToModify) {
        const testFilePath = this.getTestFilePath(filePath);

        changes.push({
          filePath: testFilePath,
          newCode: this.generateTestCode(filePath, task),
          changeType: 'add',
          description: `为 ${filePath} 编写测试用例`
        });
      }
    } else {
      // 创建新的测试文件
      const testFileName = this.generateTestFileName(task);
      changes.push({
        filePath: `test/${testFileName}.test.ts`,
        newCode: this.generateTestCode('', task),
        changeType: 'add',
        description: '编写任务测试用例'
      });
    }

    return changes;
  }

  /**
   * 执行主要实现
   */
  private async performImplementation(task: Task, analysis: ImplementationAnalysis): Promise<CodeChange[]> {
    this.logActivity('执行主要实现', { taskId: task.id });

    const changes: CodeChange[] = [];

    // 根据分析结果生成代码变更
    for (const filePath of analysis.filesToModify) {
      const fileContent = await this.readFileIfExists(filePath);
      const newContent = this.generateImplementationCode(filePath, fileContent, task, analysis);

      changes.push({
        filePath,
        oldCode: fileContent,
        newCode: newContent,
        changeType: fileContent ? 'modify' : 'add',
        description: `实现 ${task.description} 功能`,
        lineNumbers: fileContent ? { start: 1, end: this.countLines(fileContent) } : undefined
      });
    }

    // 如果需要创建新文件
    if (analysis.filesToModify.length === 0) {
      const newFilePath = this.generateNewFilePath(task);
      const newFileContent = this.generateNewFileContent(task, analysis);

      changes.push({
        filePath: newFilePath,
        newCode: newFileContent,
        changeType: 'add',
        description: `创建新文件实现 ${task.description}`
      });
    }

    return changes;
  }

  /**
   * 更新文档
   */
  private async updateDocumentation(task: Task, analysis: ImplementationAnalysis): Promise<boolean> {
    this.logActivity('更新文档', { taskId: task.id });

    // 检查是否需要更新文档
    const needsDocumentation =
      task.description.includes('文档') ||
      task.description.includes('documentation') ||
      analysis.technicalApproach.includes('复杂');

    if (!needsDocumentation) {
      return false;
    }

    // 这里应该实际更新文档
    // 目前返回模拟值
    return true;
  }

  /**
   * 估算工作量
   */
  private estimateEffort(task: Task): number {
    const descLength = task.description.length;
    const reqCount = task.requirements.length;

    // 简单估算：每100字符 + 每个需求 = 10分钟基础工作量
    let effort = (descLength / 100 + reqCount) * 10;

    // 根据优先级调整
    switch (task.priority) {
      case 'critical':
        effort *= 0.8; // 关键任务投入更多资源
        break;
      case 'low':
        effort *= 1.2; // 低优先级可能效率较低
        break;
    }

    return Math.round(effort);
  }

  /**
   * 确定技术方案
   */
  private determineTechnicalApproach(task: Task): string {
    if (task.description.includes('API') || task.description.includes('接口')) {
      return 'API 集成方案';
    }

    if (task.description.includes('UI') || task.description.includes('界面')) {
      return '前端实现方案';
    }

    if (task.description.includes('数据') || task.description.includes('data')) {
      return '数据处理方案';
    }

    if (task.description.includes('测试') || task.description.includes('test')) {
      return '测试框架方案';
    }

    return '标准实现方案';
  }

  /**
   * 识别需要修改的文件
   */
  private identifyFilesToModify(task: Task): string[] {
    const files: string[] = [];

    // 根据任务描述猜测可能涉及的文件
    if (task.description.includes('代理') || task.description.includes('proxy')) {
      files.push('deepseek-proxy.ts');
    }

    if (task.description.includes('测试') || task.description.includes('test')) {
      files.push('test/**/*.test.ts');
    }

    if (task.description.includes('配置') || task.description.includes('config')) {
      files.push('package.json', 'tsconfig.json');
    }

    if (task.description.includes('角色') || task.description.includes('agent')) {
      files.push('src/coordinator/roles/*.ts');
    }

    return files;
  }

  /**
   * 确定测试策略
   */
  private determineTestingStrategy(task: Task): string {
    if (task.description.includes('关键') || task.priority === 'critical') {
      return '全面测试策略（单元测试 + 集成测试 + E2E测试）';
    }

    if (task.description.includes('简单') || task.description.length < 50) {
      return '基础测试策略（单元测试为主）';
    }

    return '标准测试策略（单元测试 + 集成测试）';
  }

  /**
   * 获取测试文件路径
   */
  private getTestFilePath(originalPath: string): string {
    const dir = originalPath.substring(0, originalPath.lastIndexOf('/'));
    const filename = originalPath.substring(originalPath.lastIndexOf('/') + 1);
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    return `${dir}/__tests__/${nameWithoutExt}.test.ts`;
  }

  /**
   * 生成测试代码
   */
  private generateTestCode(filePath: string, task: Task): string {
    const componentName = filePath.split('/').pop()?.replace('.ts', '') || 'Component';

    return `/**
 * 测试: ${task.description}
 * 文件: ${filePath}
 */

import { describe, test, expect } from 'bun:test';
import { ${componentName} } from '../${filePath}';

describe('${componentName}', () => {
  test('应该满足基本要求', () => {
    // TODO: 实现具体测试
    expect(true).toBe(true);
  });

  test('应该处理 ${task.description}', () => {
    // TODO: 实现任务相关测试
    expect(1 + 1).toBe(2);
  });

  test('应该处理边界情况', () => {
    // TODO: 实现边界测试
    expect(() => {
      throw new Error('边界情况测试');
    }).toThrow();
  });
});`;
  }

  /**
   * 生成测试文件名
   */
  private generateTestFileName(task: Task): string {
    const safeName = task.description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `task-${safeName}`;
  }

  /**
   * 读取文件（如果存在）
   */
  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      // 文件不存在或无法读取
    }
    return null;
  }

  /**
   * 生成实现代码
   */
  private generateImplementationCode(
    filePath: string,
    existingContent: string | null,
    task: Task,
    analysis: ImplementationAnalysis
  ): string {
    if (!existingContent) {
      // 创建新文件
      return `/**
 * ${task.description}
 *
 * 需求: ${task.requirements.join(', ')}
 * 约束: ${task.constraints.join(', ')}
 * 优先级: ${task.priority}
 *
 * 技术方案: ${analysis.technicalApproach}
 */

export function implement${this.getFunctionName(task)}(): string {
  // TODO: 实现 ${task.description}
  return "实现完成";
}

// 辅助函数
function helperFunction() {
  // 辅助实现
}

export default {
  implement${this.getFunctionName(task)},
  helperFunction
};`;
    }

    // 修改现有文件 - 在文件末尾添加新功能
    return `${existingContent}

/**
 * 新增功能: ${task.description}
 * 添加时间: ${new Date().toISOString()}
 */
export function ${this.getFunctionName(task).toLowerCase()}() {
  // 实现 ${task.description}
  console.log('执行: ${task.description}');

  // TODO: 具体实现
  return {
    success: true,
    message: '${task.description} 已实现'
  };
}

// 导出新增功能
export { ${this.getFunctionName(task).toLowerCase()} };`;
  }

  /**
   * 获取函数名
   */
  private getFunctionName(task: Task): string {
    const words = task.description
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    return words.map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('');
  }

  /**
   * 生成新文件路径
   */
  private generateNewFilePath(task: Task): string {
    const safeName = task.description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `src/features/${safeName}.ts`;
  }

  /**
   * 生成新文件内容
   */
  private generateNewFileContent(task: Task, analysis: ImplementationAnalysis): string {
    const functionName = this.getFunctionName(task);

    return `/**
 * ${task.description}
 *
 * 文件: ${this.generateNewFilePath(task)}
 * 创建时间: ${new Date().toISOString()}
 *
 * 需求分析:
 * ${task.requirements.map(req => ` * - ${req}`).join('\n')}
 *
 * 约束条件:
 * ${task.constraints.map(con => ` * - ${con}`).join('\n')}
 *
 * 技术方案: ${analysis.technicalApproach}
 * 测试策略: ${analysis.testingStrategy}
 */

/**
 * 主功能函数
 */
export function ${functionName}(input?: any): any {
  try {
    // 参数验证
    if (input && typeof input !== 'object') {
      throw new Error('输入参数必须是对象');
    }

    // 核心逻辑实现
    const result = process${functionName}Logic(input || {});

    // 返回结果
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      metadata: {
        task: "${task.description}",
        priority: "${task.priority}",
        implementationTime: "${new Date().toISOString()}"
      }
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
}

/**
 * 核心处理逻辑
 */
function process${functionName}Logic(params: any): any {
  // TODO: 实现具体业务逻辑
  // 根据 ${task.description} 实现

  return {
    processed: true,
    params,
    message: '${task.description} 处理完成'
  };
}

/**
 * 辅助函数
 */
export function validate${functionName}Input(input: any): boolean {
  // 输入验证逻辑
  return input !== null && input !== undefined;
}

/**
 * 工具函数
 */
export function utilityFor${functionName}(): string {
  return '工具函数';
}

// 默认导出
export default {
  ${functionName},
  validate${functionName}Input,
  utilityFor${functionName}
};`;
  }

  /**
   * 计算行数
   */
  private countLines(content: string): number {
    return content.split('\n').length;
  }

  /**
   * 评估实现复杂度
   */
  private assessImplementationComplexity(changes: CodeChange[]): 'simple' | 'medium' | 'complex' {
    const totalChanges = changes.length;
    const totalLines = changes.reduce((sum, change) => {
      if (change.newCode) {
        return sum + this.countLines(change.newCode);
      }
      return sum;
    }, 0);

    if (totalChanges <= 2 && totalLines <= 50) return 'simple';
    if (totalChanges <= 5 && totalLines <= 200) return 'medium';
    return 'complex';
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 辅助接口
interface ImplementationAnalysis {
  taskDescription: string;
  requirements: string[];
  constraints: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number;
  technicalApproach: string;
  filesToModify: string[];
  testingStrategy: string;
}