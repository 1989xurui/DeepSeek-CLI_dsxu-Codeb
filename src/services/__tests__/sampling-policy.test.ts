/**
 * R5-20: Sampling policy 测试
 */

import { describe, it, expect } from 'bun:test';
import { SamplingPolicy, TaskClassifier, TaskType } from '../sampling-policy';

describe('R5-20: Per-turn sampling 策略器', () => {
  describe('TaskClassifier', () => {
    const classifier = new TaskClassifier();

    it('应正确分类代码生成任务', () => {
      const messages = [
        { role: 'user', content: 'Write a function to calculate factorial in JavaScript' }
      ];

      const classification = classifier.classify(messages);
      expect(classification.type).toBe('code-generation');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应正确分类复杂推理任务', () => {
      const messages = [
        { role: 'user', content: 'Think step by step: If I have 5 apples and give 2 to my friend, then buy 3 more, how many do I have?' }
      ];

      const classification = classifier.classify(messages);
      expect(classification.type).toBe('complex-reasoning');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应正确分类工具密集型任务', () => {
      const messages = [
        { role: 'user', content: 'Search for information about climate change and summarize it' }
      ];
      const tools = [
        { name: 'search', description: 'Search the web' },
        { name: 'read_file', description: 'Read a file' }
      ];

      const classification = classifier.classify(messages, tools);
      expect(classification.type).toBe('tool-intensive');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应正确分类创意写作任务', () => {
      const messages = [
        { role: 'user', content: 'Write a short story about a robot who learns to love' }
      ];

      const classification = classifier.classify(messages);
      expect(classification.type).toBe('creative-writing');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应正确分类事实问答任务', () => {
      const messages = [
        { role: 'user', content: 'What is the capital of France?' }
      ];

      const classification = classifier.classify(messages);
      expect(classification.type).toBe('factual-qa');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应正确分类调试任务', () => {
      const messages = [
        { role: 'user', content: 'My code has an error: TypeError: Cannot read property of undefined. How do I fix it?' }
      ];

      const classification = classifier.classify(messages);
      expect(classification.type).toBe('debugging');
      expect(classification.confidence).toBeGreaterThan(0.3);
    });

    it('应处理空消息返回默认类型', () => {
      const classification = classifier.classify([]);
      expect(classification.type).toBe('default');
    });
  });

  describe('SamplingPolicy', () => {
    const policy = new SamplingPolicy();

    it('应为代码生成任务返回正确的采样配置', () => {
      const messages = [
        { role: 'user', content: 'Write a Python function to sort a list' }
      ];

      const config = policy.getSamplingConfig(messages);
      expect(config.model).toBe('deepseek-v4-flash');
      expect(config.temperature).toBe(0.7);
      expect(config.top_p).toBe(0.95);
    });

    it('应为复杂推理任务返回 V4 Flash thinking route', () => {
      const messages = [
        { role: 'user', content: 'Analyze this problem and provide a step-by-step solution' }
      ];

      const config = policy.getSamplingConfig(messages);
      expect(config.model).toBe('deepseek-v4-flash');
      expect(config.routeReason).toBe('planning_flash_thinking_max');
      expect(config.temperature).toBe(0.3);
      expect(config.top_p).toBe(0.9);
    });

    it('应为工具密集型任务返回 V4 Flash 模型', () => {
      const messages = [
        { role: 'user', content: 'Use tools to gather and analyze data' }
      ];
      const tools = [{ name: 'search' }];

      const config = policy.getSamplingConfig(messages, tools);
      expect(config.model).toBe('deepseek-v4-flash');
      expect(config.temperature).toBe(0.5);
      expect(config.top_p).toBe(0.95);
    });

    it('应为创意写作任务返回高 temperature', () => {
      const messages = [
        { role: 'user', content: 'Write a creative poem about the ocean' }
      ];

      const config = policy.getSamplingConfig(messages);
      expect(config.temperature).toBe(0.9);
      expect(config.top_p).toBe(0.99);
    });

    it('应为事实问答任务返回低 temperature', () => {
      const messages = [
        { role: 'user', content: 'What year was the first computer invented?' }
      ];

      const config = policy.getSamplingConfig(messages);
      expect(config.temperature).toBe(0.2);
      expect(config.top_p).toBe(0.85);
    });

    it('应为调试任务返回 V4 recovery route', () => {
      const messages = [
        { role: 'user', content: 'Debug this error in my code' }
      ];

      const config = policy.getSamplingConfig(messages);
      expect(config.model).toBe('deepseek-v4-flash');
      expect(config.routeReason).toBe('recovery_flash_thinking_max');
      expect(config.temperature).toBe(0.4);
      expect(config.top_p).toBe(0.9);
    });

    it('应支持直接根据任务类型获取配置', () => {
      const config = policy.getConfigForTaskType('code-generation');
      expect(config.temperature).toBe(0.7);
      expect(config.top_p).toBe(0.95);
      expect(config.model).toBe('deepseek-v4-flash');
    });

    it('应返回所有策略配置', () => {
      const strategies = policy.getAllStrategies();
      expect(strategies['code-generation'].temperature).toBe(0.7);
      expect(strategies['complex-reasoning'].model).toBe('deepseek-v4-flash');
      expect(strategies['complex-reasoning'].routeReason).toBe('planning_flash_thinking_max');
      expect(strategies['creative-writing'].temperature).toBe(0.9);
      expect(strategies['factual-qa'].temperature).toBe(0.2);
      expect(strategies['debugging'].model).toBe('deepseek-v4-flash');
      expect(strategies['debugging'].routeReason).toBe('recovery_flash_thinking_max');
      expect(strategies['default'].temperature).toBe(0.5);
    });

    it('应处理多块内容的消息', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Write a function' },
            { type: 'text', text: '```python\ndef hello():\n    return "world"\n```' }
          ]
        }
      ];

      const config = policy.getSamplingConfig(messages);
      // 多块内容包含代码，应该使用代码生成的配置
      expect(config.temperature).toBe(0.7);
      expect(config.top_p).toBe(0.95);
      expect(config.model).toBe('deepseek-v4-flash');
    });

    it('应考虑历史上下文', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Now write some code for me' }
      ];

      const config = policy.getSamplingConfig(messages);
      // "write some code" 应该触发代码生成配置
      expect(config.temperature).toBe(0.7);
      expect(config.top_p).toBe(0.95);
      expect(config.model).toBe('deepseek-v4-flash');
    });
  });

  describe('边界情况', () => {
    const policy = new SamplingPolicy();

    it('应处理非常短的消息', () => {
      const messages = [
        { role: 'user', content: 'Hi' }
      ];

      const config = policy.getSamplingConfig(messages);
      // 短消息应该使用默认配置
      expect(config.temperature).toBe(0.5);
      expect(config.top_p).toBe(0.95);
      expect(config.model).toBe('deepseek-v4-flash');
    });

    it('应处理非常长的消息', () => {
      const longContent = 'Write code '.repeat(100);
      const messages = [
        { role: 'user', content: longContent }
      ];

      const config = policy.getSamplingConfig(messages);
      // 长消息包含 "Write code"，应该使用代码生成配置
      expect(config.temperature).toBe(0.7);
      expect(config.top_p).toBe(0.95);
      expect(config.model).toBe('deepseek-v4-flash');
    });

    it('应处理混合特征的消息', () => {
      const messages = [
        { role: 'user', content: 'Debug this code and also write a creative story about it' }
      ];

      const config = policy.getSamplingConfig(messages);
      // 混合特征的消息应该返回一个有效的配置
      expect(config.temperature).toBeDefined();
      expect(config.top_p).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.temperature).toBeGreaterThan(0);
      expect(config.temperature).toBeLessThanOrEqual(1);
      expect(config.top_p).toBeGreaterThan(0);
      expect(config.top_p).toBeLessThanOrEqual(1);
    });

    it('应处理包含工具结果的消息', () => {
      const messages = [
        { role: 'user', content: 'Search for something' },
        { role: 'assistant', content: '', tool_calls: [{ id: '1', function: { name: 'search' } }] },
        { role: 'tool', tool_call_id: '1', content: 'Search results here' },
        { role: 'user', content: 'Now analyze the results' }
      ];

      const config = policy.getSamplingConfig(messages);
      // 应该返回一个有效的配置
      expect(config.temperature).toBeDefined();
      expect(config.top_p).toBeDefined();
      expect(config.model).toBeDefined();
    });
  });
});
