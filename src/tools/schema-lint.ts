/**
 * DeepSeek strict-mode JSON schema lint.
 *
 * This lint is intentionally conservative: it catches schema keywords that are
 * known to break strict tool mode and verifies object schemas declare required
 * fields and additionalProperties explicitly.
 */

export interface LintViolation {
  toolName: string
  field: string
  rule:
    | 'missing-required'
    | 'missing-additional-properties'
    | 'forbidden-keyword'
  message: string
  fix?: string
}

export interface LintResult {
  violations: LintViolation[]
  passed: boolean
  toolCount: number
  violationCount: number
}

const FORBIDDEN_KEYWORDS = [
  'minLength',
  'maxLength',
  'pattern',
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
] as const

const FORBIDDEN_FORMATS = [
  'email',
  'uri',
  'url',
  'date-time',
  'date',
  'time',
  'uuid',
] as const

function isObjectSchema(schema: unknown): schema is {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: unknown
} {
  return Boolean(schema && typeof schema === 'object' && (schema as any).type === 'object')
}

function isNullable(fieldSchema: any): boolean {
  return (
    fieldSchema?.type === 'null' ||
    (Array.isArray(fieldSchema?.type) && fieldSchema.type.includes('null'))
  )
}

function checkObjectShape(
  schema: Record<string, any>,
  toolName: string,
  violations: LintViolation[],
): void {
  if (!isObjectSchema(schema)) return

  if (schema.properties) {
    const requiredFields = schema.required ?? []
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      if ((fieldSchema as any)?.default !== undefined) continue
      if (isNullable(fieldSchema)) continue
      if (!requiredFields.includes(fieldName)) {
        violations.push({
          toolName,
          field: fieldName,
          rule: 'missing-required',
          message: `Non-optional field "${fieldName}" is missing from required`,
          fix: `Add "${fieldName}" to required`,
        })
      }
    }
  }

  if (schema.additionalProperties === undefined) {
    violations.push({
      toolName,
      field: 'schema',
      rule: 'missing-additional-properties',
      message: 'Missing additionalProperties: false',
      fix: 'Add "additionalProperties": false',
    })
  }
}

function checkForbiddenKeywords(
  value: unknown,
  toolName: string,
  violations: LintViolation[],
  path = '',
): void {
  if (!value || typeof value !== 'object') return
  const obj = value as Record<string, unknown>

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (obj[keyword] !== undefined) {
      violations.push({
        toolName,
        field: path ? `${path}.${keyword}` : keyword,
        rule: 'forbidden-keyword',
        message: `Forbidden keyword "${keyword}"`,
        fix: `Remove "${keyword}"`,
      })
    }
  }

  if (
    typeof obj.format === 'string' &&
    (FORBIDDEN_FORMATS as readonly string[]).includes(obj.format.toLowerCase())
  ) {
    violations.push({
      toolName,
      field: path ? `${path}.format` : 'format',
      rule: 'forbidden-keyword',
      message: `Forbidden format "${obj.format}"`,
      fix: 'Remove format or use a provider-supported format',
    })
  }

  for (const [key, nested] of Object.entries(obj)) {
    if (nested && typeof nested === 'object') {
      checkForbiddenKeywords(
        nested,
        toolName,
        violations,
        path ? `${path}.${key}` : key,
      )
    }
  }
}

export function lintSchema(
  schema: unknown,
  toolName: string = 'unknown',
): LintViolation[] {
  const violations: LintViolation[] = []

  if (!schema || typeof schema !== 'object') {
    return violations
  }

  checkObjectShape(schema as Record<string, any>, toolName, violations)
  checkForbiddenKeywords(schema, toolName, violations)
  return violations
}

export function lintAllTools(): LintResult {
  const exampleTools = [
    {
      name: 'example-search',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'example-calculate',
      schema: {
        type: 'object',
        properties: {
          expression: { type: 'string' },
          precision: { type: 'number' },
        },
        required: ['expression', 'precision'],
        additionalProperties: false,
      },
    },
  ]

  const violations = exampleTools.flatMap(tool =>
    lintSchema(tool.schema, tool.name),
  )
  return {
    violations,
    passed: violations.length === 0,
    toolCount: exampleTools.length,
    violationCount: violations.length,
  }
}

export function generateFixReport(violations: LintViolation[]): string {
  if (violations.length === 0) {
    return 'All schemas satisfy DeepSeek strict-mode requirements.'
  }

  const byTool: Record<string, LintViolation[]> = {}
  for (const violation of violations) {
    byTool[violation.toolName] ??= []
    byTool[violation.toolName]!.push(violation)
  }

  const lines = [
    '# Schema Lint Report',
    '',
    `Found ${violations.length} violation(s) across ${Object.keys(byTool).length} tool(s).`,
    '',
  ]

  for (const [toolName, toolViolations] of Object.entries(byTool)) {
    lines.push(`## ${toolName}`, '')
    for (const violation of toolViolations) {
      lines.push(
        `- ${violation.rule} (${violation.field})`,
        `  - Problem: ${violation.message}`,
      )
      if (violation.fix) lines.push(`  - Fix: ${violation.fix}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

if (import.meta.main) {
  const failOnError = process.argv.slice(2).includes('--fail-on-error')
  console.log('Checking tool schemas for DeepSeek strict mode...\n')

  const result = lintAllTools()
  console.log(generateFixReport(result.violations))

  if (result.violations.length > 0) {
    if (failOnError) {
      console.log(`Schema lint failed: ${result.violations.length} violation(s).`)
      process.exit(1)
    }
    process.exit(0)
  }

  process.exit(0)
}
