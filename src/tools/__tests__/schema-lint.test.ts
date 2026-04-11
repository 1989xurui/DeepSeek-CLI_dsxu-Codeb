/**
 * R5-03: Schema lint 测试
 */

import { describe, it, expect } from 'bun:test';
import { lintSchema, LintViolation } from '../schema-lint';

describe('R5-03: Strict mode schema lint', () => {
  describe('规则1: required 字段检查', () => {
    it('应检测缺失的 required 字段', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          optionalField: { type: 'string', default: '' }
        },
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');

      expect(violations).toHaveLength(2); // name 和 age 都缺失
      expect(violations[0].rule).toBe('missing-required');
      expect(violations[0].field).toBe('name');
      expect(violations[1].field).toBe('age');
    });

    it('应通过完整的 required 列表', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          optionalField: { type: 'string', default: '' }
        },
        required: ['name', 'age'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(0);
    });

    it('应处理 nullable 字段为可选', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] }, // nullable，应为可选
          age: { type: 'number' }
        },
        required: ['age'], // 只要求 age
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(0);
    });
  });

  describe('规则2: additionalProperties 检查', () => {
    it('应检测缺失的 additionalProperties: false', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
        // 缺少 additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('missing-additional-properties');
      expect(violations[0].message).toContain('additionalProperties: false');
    });

    it('应通过正确的 additionalProperties: false', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(0);
    });

    it('应允许 additionalProperties: true（虽然不推荐）', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name'],
        additionalProperties: true // 允许但可能不是最佳实践
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(0); // 不检查 true，只检查缺失
    });
  });

  describe('规则3: 禁止关键字检查', () => {
    it('应检测 minLength 关键字', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 }
        },
        required: ['name'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');

      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('forbidden-keyword');
      expect(violations[0].field).toBe('properties.name.minLength');
    });

    it('应检测 maxLength 关键字', () => {
      const schema = {
        type: 'object',
        properties: {
          description: { type: 'string', maxLength: 100 }
        },
        required: ['description'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(1);
      expect(violations[0].field).toBe('properties.description.maxLength');
    });

    it('应检测 format 关键字（特定格式）', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          uri: { type: 'string', format: 'uri' }
        },
        required: ['email', 'uri'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(2);
      expect(violations[0].field).toBe('properties.email.format');
      expect(violations[1].field).toBe('properties.uri.format');
    });

    it('应允许非禁止的 format', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'string', format: 'custom-format' } // 自定义格式允许
        },
        required: ['data'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(0);
    });

    it('应递归检测嵌套对象中的禁止关键字', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              timeout: { type: 'number', minimum: 0, maximum: 100 }
            },
            required: ['timeout'],
            additionalProperties: false
          }
        },
        required: ['config'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      expect(violations).toHaveLength(2); // minimum 和 maximum
      // 检查两个字段都存在，不关心顺序
      const fields = violations.map(v => v.field);
      expect(fields).toContain('properties.config.properties.timeout.minimum');
      expect(fields).toContain('properties.config.properties.timeout.maximum');
    });

    it('应检测数组中的禁止关键字', () => {
      const schema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            maxItems: 10
          }
        },
        required: ['items'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'test-tool');
      // minLength, minItems, maxItems 共3个
      expect(violations).toHaveLength(3);
    });
  });

  describe('综合测试', () => {
    it('应检测所有类型的违规', () => {
      const schema = {
        type: 'object',
        properties: {
          // 缺失 required
          name: { type: 'string', minLength: 1 },
          // 缺失 required + 禁止的 format
          email: { type: 'string', format: 'email' },
          // 有默认值，应为可选
          optional: { type: 'string', default: 'default' }
        }
        // 缺少 additionalProperties: false
        // 缺少 required 数组
      };

      const violations = lintSchema(schema, 'comprehensive-tool');

      // 预期违规：
      // 预期违规：
      // 1. name 缺失 required
      // 2. name 有 minLength
      // 3. email 缺失 required
      // 4. email 有 format: email
      // 5. 缺少 additionalProperties: false
      expect(violations).toHaveLength(5);

      const rules = violations.map(v => v.rule);
      expect(rules).toContain('missing-required');
      expect(rules).toContain('forbidden-keyword');
      expect(rules).toContain('missing-additional-properties');
    });

    it('完美符合 strict mode 的 schema 应通过', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          enabled: { type: 'boolean', default: true },
          metadata: {
            type: 'object',
            properties: {
              tags: { type: 'array', items: { type: 'string' } }
            },
            required: ['tags'],
            additionalProperties: false
          }
        },
        required: ['name', 'count', 'metadata'],
        additionalProperties: false
      };

      const violations = lintSchema(schema, 'perfect-tool');
      expect(violations).toHaveLength(0);
    });
  });

  describe('边界情况处理', () => {
    it('应处理空 schema', () => {
      const violations = lintSchema({}, 'empty-tool');
      expect(violations).toHaveLength(0);
    });

    it('应处理 null schema', () => {
      const violations = lintSchema(null, 'null-tool');
      expect(violations).toHaveLength(0);
    });

    it('应处理非对象 schema', () => {
      const violations = lintSchema('not-an-object', 'string-tool');
      expect(violations).toHaveLength(0);
    });

    it('应处理非 object 类型的 schema', () => {
      const schema = {
        type: 'string',
        minLength: 1 // 即使有禁止关键字，但 type 不是 object，不检查
      };

      const violations = lintSchema(schema, 'string-schema-tool');
      // 对于非 object 类型，不检查 required 和 additionalProperties
      // 但会检查禁止关键字
      expect(violations).toHaveLength(1);
      expect(violations[0].rule).toBe('forbidden-keyword');
    });
  });
});