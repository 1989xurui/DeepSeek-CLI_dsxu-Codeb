/**
 * R5-03: Strict mode schema lint
 *
 * 目标：确保所有工具 JSON Schema 满足 DeepSeek strict mode 三规则：
 * 1. `required` 必须显式列出所有非可选字段
 * 2. `additionalProperties: false` 必须显式
 * 3. 禁用 `minLength` / `maxLength` / `format=email` / `format=uri` 等 V3.2 不支持的关键字
 */

export interface LintViolation {
  toolName: string;
  field: string;
  rule: 'missing-required' | 'missing-additional-properties' | 'forbidden-keyword';
  message: string;
  fix?: string;
}

export interface LintResult {
  violations: LintViolation[];
  passed: boolean;
  toolCount: number;
  violationCount: number;
}

/**
 * DeepSeek strict mode 禁止的关键字
 */
const FORBIDDEN_KEYWORDS = [
  'minLength',
  'maxLength',
  'pattern', // 正则表达式
  'multipleOf',
  'maximum',
  'minimum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'uniqueItems',
  'maxItems',
  'minItems',
  'maxProperties',
  'minProperties',
];

/**
 * 检查单个 schema 是否符合 strict mode
 */
export function lintSchema(schema: any, toolName: string = 'unknown'): LintViolation[] {
  const violations: LintViolation[] = [];

  if (!schema || typeof schema !== 'object') {
    return violations;
  }

  // 规则1: 检查 required 字段
  if (schema.type === 'object' && schema.properties) {
    const requiredFields = schema.required || [];
    const propertyNames = Object.keys(schema.properties);

    // 找出所有非可选字段（没有默认值且不是 nullable）
    const nonOptionalFields = propertyNames.filter(fieldName => {
      const fieldSchema = schema.properties[fieldName];
      // 如果有默认值，则是可选的
      if (fieldSchema?.default !== undefined) return false;
      // 如果允许 null，则是可选的
      if (Array.isArray(fieldSchema?.type) && fieldSchema.type.includes('null')) return false;
      // 如果 type 包含 null，则是可选的
      if (fieldSchema?.type === 'null') return false;
      return true;
    });

    // 检查所有非可选字段是否都在 required 中
    for (const field of nonOptionalFields) {
      if (!requiredFields.includes(field)) {
        violations.push({
          toolName,
          field,
          rule: 'missing-required',
          message: `非可选字段 "${field}" 未在 required 列表中`,
          fix: `将 "${field}" 添加到 required 数组`
        });
      }
    }
  }

  // 规则2: 检查 additionalProperties
  if (schema.type === 'object' && schema.additionalProperties === undefined) {
    violations.push({
      toolName,
      field: 'schema',
      rule: 'missing-additional-properties',
      message: '缺少 additionalProperties: false',
      fix: '添加 "additionalProperties: false"'
    });
  }

  // 规则3: 检查禁止的关键字（递归检查）
  function checkForbiddenKeywords(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return;

    // 检查当前对象的禁止关键字
    for (const keyword of FORBIDDEN_KEYWORDS) {
      if (obj[keyword] !== undefined) {
        const fullPath = path ? `${path}.${keyword}` : keyword;
        violations.push({
          toolName,
          field: fullPath,
          rule: 'forbidden-keyword',
          message: `禁止使用关键字 "${keyword}"`,
          fix: `移除 "${keyword}" 字段`
        });
      }
    }

    // 检查 format 字段 - 根据 DeepSeek 文档，某些 format 可能不被支持
    if (obj.format) {
      const forbiddenFormats = ['email', 'uri', 'url', 'date-time', 'date', 'time', 'uuid'];
      // 检查是否是禁止的格式
      if (forbiddenFormats.includes(String(obj.format).toLowerCase())) {
        const fullPath = path ? `${path}.format` : 'format';
        violations.push({
          toolName,
          field: fullPath,
          rule: 'forbidden-keyword',
          message: `禁止使用 format: "${obj.format}"`,
          fix: `移除 format 字段或使用允许的格式`
        });
      }
    }

    // 递归检查所有属性
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
        const newPath = path ? `${path}.${key}` : key;
        checkForbiddenKeywords(obj[key], newPath);
      }
    }
  }

  checkForbiddenKeywords(schema);

  return violations;
}

/**
 * 收集所有工具并检查它们的 schema
 */
export function lintAllTools(): LintResult {
  const violations: LintViolation[] = [];
  let toolCount = 0;

  // 示例工具 schema 用于测试
  const exampleTools = [
    {
      name: 'example-search',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      name: 'example-calculate',
      schema: {
        type: 'object',
        properties: {
          expression: { type: 'string', minLength: 1 }, // 违规: minLength
          precision: { type: 'number' }
        },
        required: ['expression'], // 违规: precision 缺失
        // 违规: 缺少 additionalProperties: false
      }
    }
  ];

  for (const tool of exampleTools) {
    toolCount++;
    const toolViolations = lintSchema(tool.schema, tool.name);
    violations.push(...toolViolations);
  }

  return {
    violations,
    passed: violations.length === 0,
    toolCount,
    violationCount: violations.length
  };
}

/**
 * 生成修复建议报告
 */
export function generateFixReport(violations: LintViolation[]): string {
  if (violations.length === 0) {
    return '✅ 所有 schema 符合 strict mode 要求';
  }

  const byTool: Record<string, LintViolation[]> = {};
  for (const violation of violations) {
    if (!byTool[violation.toolName]) {
      byTool[violation.toolName] = [];
    }
    byTool[violation.toolName].push(violation);
  }

  let report = `# Schema Lint 报告\n\n`;
  report += `发现 ${violations.length} 个违规项，涉及 ${Object.keys(byTool).length} 个工具\n\n`;

  for (const [toolName, toolViolations] of Object.entries(byTool)) {
    report += `## ${toolName}\n\n`;
    for (const violation of toolViolations) {
      report += `- **${violation.rule}** (字段: ${violation.field})\n`;
      report += `  - 问题: ${violation.message}\n`;
      if (violation.fix) {
        report += `  - 修复: ${violation.fix}\n`;
      }
      report += '\n';
    }
  }

  return report;
}

/**
 * CLI 入口点
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const failOnError = args.includes('--fail-on-error');

  console.log('🔍 检查工具 schema 是否符合 DeepSeek strict mode...\n');

  const result = lintAllTools();

  if (result.violations.length > 0) {
    console.log(generateFixReport(result.violations));

    if (failOnError) {
      console.log(`❌ 发现 ${result.violations.length} 个违规项，构建失败`);
      process.exit(1);
    } else {
      console.log(`⚠️  发现 ${result.violations.length} 个违规项，请修复`);
      process.exit(0);
    }
  } else {
    console.log('✅ 所有工具 schema 符合 strict mode 要求');
    process.exit(0);
  }
}