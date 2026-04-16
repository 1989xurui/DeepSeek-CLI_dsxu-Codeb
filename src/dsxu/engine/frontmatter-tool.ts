/**
 * Frontmatter Tool - 在 QueryEngine 中使用的 frontmatter 解析工具
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { parseFrontmatter, parseFrontmatterFromFile, composeFrontmatter } from './frontmatter-parser'

export const FrontmatterTool: ToolDefinition = {
  name: 'Frontmatter',
  description: '解析和生成 YAML frontmatter。支持从文本或文件解析，以及组合 frontmatter 和正文。',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['parse', 'parse_file', 'compose'],
        description: '操作类型：parse（解析文本）、parse_file（解析文件）、compose（组合）'
      },
      text: {
        type: 'string',
        description: '要解析的文本（action=parse 时必填）'
      },
      file_path: {
        type: 'string',
        description: '文件路径（action=parse_file 时必填）'
      },
      frontmatter: {
        type: 'object',
        description: 'frontmatter 对象（action=compose 时必填）'
      },
      body: {
        type: 'string',
        description: '正文内容（action=compose 时必填）'
      }
    },
    required: ['action']
  },
  async execute(args: any, context: ToolContext): Promise<ToolOutput> {
    try {
      const { action, text, file_path, frontmatter, body } = args

      switch (action) {
        case 'parse': {
          if (!text) {
            throw new Error('text 参数是必需的')
          }
          const result = parseFrontmatter(text)
          return {
            content: JSON.stringify({
              success: true,
              frontmatter: result.frontmatter,
              body: result.body,
              hasFrontmatter: result.hasFrontmatter,
              error: result.error
            }, null, 2),
            isError: false
          }
        }

        case 'parse_file': {
          if (!file_path) {
            throw new Error('file_path 参数是必需的')
          }
          const result = await parseFrontmatterFromFile(file_path)
          return {
            content: JSON.stringify({
              success: true,
              frontmatter: result.frontmatter,
              body: result.body,
              hasFrontmatter: result.hasFrontmatter,
              error: result.error
            }, null, 2),
            isError: false
          }
        }

        case 'compose': {
          if (!frontmatter || !body) {
            throw new Error('frontmatter 和 body 参数都是必需的')
          }
          const composed = composeFrontmatter(frontmatter, body)
          return {
            content: JSON.stringify({
              success: true,
              composed: composed
            }, null, 2),
            isError: false
          }
        }

        default:
          throw new Error(`不支持的操作类型: ${action}`)
      }
    } catch (error) {
      return {
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }, null, 2),
        isError: true
      }
    }
  }
}

/**
 * 将 frontmatter 工具注册到工具注册表
 */
export function registerFrontmatterTool(toolRegistry: any): void {
  // 这里假设 toolRegistry 有 register 方法
  if (toolRegistry && typeof toolRegistry.register === 'function') {
    toolRegistry.register(FrontmatterTool)
  }
}