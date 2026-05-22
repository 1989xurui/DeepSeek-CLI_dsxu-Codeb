import { describe, expect, test } from 'bun:test'
import { DeepSeekAdapter } from '../../../services/api/deepseek-adapter'

describe('V6 Strict Tool Schema Gateway', () => {
  test('compiles nested tool schemas into DeepSeek-safe flat parameters', () => {
    const inputSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: {
          type: 'object',
          properties: {
            include: { type: 'array', items: { type: 'string' } },
            exclude: { type: 'array', items: { type: 'string' } },
            options: {
              type: 'object',
              properties: {
                caseSensitive: { type: 'boolean' },
                maxResults: { type: 'number' },
              },
              required: ['caseSensitive', 'maxResults'],
              additionalProperties: false,
            },
          },
          required: ['include', 'exclude', 'options'],
          additionalProperties: false,
        },
        evidence: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
            risk: { type: 'string' },
          },
          required: ['owner', 'risk'],
          additionalProperties: false,
        },
      },
      required: ['query', 'scope', 'evidence'],
      additionalProperties: false,
    }

    const plan = DeepSeekAdapter.planDeepSeekToolSchemaFlattening(inputSchema)
    const parameters = plan.flattenedSchema as {
      type: string
      properties: Record<string, unknown>
      required: string[]
      additionalProperties: boolean
    }

    expect(plan.shouldFlatten).toBe(true)
    expect(parameters.type).toBe('object')
    expect(parameters.additionalProperties).toBe(false)
    expect(parameters.required).toEqual(
      expect.arrayContaining([
        'query',
        'scope__include',
        'scope__exclude',
        'scope__options__caseSensitive',
        'scope__options__maxResults',
        'evidence__owner',
        'evidence__risk',
      ]),
    )
    expect(Object.keys(parameters.properties)).toEqual(
      expect.arrayContaining(['scope__options__caseSensitive', 'evidence__owner']),
    )
  })

  test('restores flattened DeepSeek tool arguments before DSXU tool execution', () => {
    const plan = DeepSeekAdapter.planDeepSeekToolSchemaFlattening({
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: {
          type: 'object',
          properties: {
            include: { type: 'array', items: { type: 'string' } },
            options: {
              type: 'object',
              properties: {
                maxResults: { type: 'number' },
              },
              required: ['maxResults'],
              additionalProperties: false,
            },
          },
          required: ['include', 'options'],
          additionalProperties: false,
        },
      },
      required: ['query', 'scope'],
      additionalProperties: false,
    })

    const nested = DeepSeekAdapter.nestDeepSeekFlattenedArguments(
      {
        query: 'route policy',
        scope__include: ['src'],
        scope__options__maxResults: 20,
        extra_preview_only: true,
      },
      plan,
    )

    expect(nested).toEqual({
      query: 'route policy',
      scope: {
        include: ['src'],
        options: {
          maxResults: 20,
        },
      },
      extra_preview_only: true,
    })
  })

  test('builds provider tools with strict parameters through the existing DeepSeek adapter', () => {
    const tool = {
      name: 'SearchOwnerEvidence',
      description: 'Search source owner evidence.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          scope: {
            type: 'object',
            properties: {
              owner: { type: 'string' },
              paths: { type: 'array', items: { type: 'string' } },
              options: {
                type: 'object',
                properties: {
                  maxResults: { type: 'number' },
                  includeTests: { type: 'boolean' },
                },
                required: ['maxResults', 'includeTests'],
                additionalProperties: false,
              },
            },
            required: ['owner', 'paths', 'options'],
            additionalProperties: false,
          },
        },
        required: ['query', 'scope'],
        additionalProperties: false,
      },
    }
    const plans = DeepSeekAdapter.buildDeepSeekToolSchemaPlans([tool])
    const providerTool = DeepSeekAdapter.normalizeDeepSeekProviderTool(tool, plans)
    const parameters = providerTool?.function?.parameters as {
      additionalProperties?: boolean
      properties?: Record<string, unknown>
    }

    expect(providerTool?.type).toBe('function')
    expect(parameters.additionalProperties).toBe(false)
    expect(Object.keys(parameters.properties ?? {})).toEqual(
      expect.arrayContaining([
        'query',
        'scope__owner',
        'scope__paths',
        'scope__options__maxResults',
        'scope__options__includeTests',
      ]),
    )
  })
})
