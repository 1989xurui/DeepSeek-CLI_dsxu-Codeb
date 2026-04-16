/**
 * Magic Docs Tool - 在 QueryEngine 中使用的 Magic Docs 工具
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { MagicDocsManager, createMagicDocsManager } from './magic-docs'

export const MagicDocsTool: ToolDefinition = {
  name: 'MagicDocs',
  description: '自动维护标记为 # MAGIC DOC: 的文档。支持扫描目录、更新文档和保存更改。',
  schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['scan', 'update', 'save', 'stats'],
        description: '操作类型：scan（扫描目录）、update（更新文档）、save（保存更改）、stats（获取统计）'
      },
      directory: {
        type: 'string',
        description: '要扫描的目录路径（action=scan 时必填）'
      },
      update_function: {
        type: 'string',
        enum: ['simple', 'llm'],
        description: '更新函数类型：simple（简单更新）、llm（使用LLM更新，暂未实现）'
      },
      dry_run: {
        type: 'boolean',
        description: '是否试运行（不实际保存文件）',
        default: true
      }
    },
    required: ['action']
  },
  async execute(args: any, context: ToolContext): Promise<ToolOutput> {
    try {
      const { action, directory, update_function = 'simple', dry_run = true } = args
      const manager = createMagicDocsManager()

      switch (action) {
        case 'scan': {
          if (!directory) {
            throw new Error('directory 参数是必需的')
          }

          const docs = await manager.scanDirectory(directory)
          return {
            content: JSON.stringify({
              success: true,
              action: 'scan',
              directory,
              found: docs.length,
              docs: docs.map(doc => ({
                id: doc.id,
                filePath: doc.filePath,
                title: doc.title,
                hasUpdates: doc.isUpdated
              }))
            }, null, 2),
            isError: false
          }
        }

        case 'update': {
          if (!directory) {
            throw new Error('directory 参数是必需的')
          }

          // 先扫描文档
          const docs = await manager.scanDirectory(directory)
          if (docs.length === 0) {
            return {
              content: JSON.stringify({
                success: true,
                action: 'update',
                directory,
                message: '未找到 Magic Docs',
                found: 0
              }, null, 2),
              isError: false
            }
          }

          // 选择更新函数
          let updateFn: (content: string) => Promise<string>
          if (update_function === 'llm') {
            // TODO: 实现 LLM 更新函数
            updateFn = async (content: string) => {
              // 占位实现
              return content + '\n\n[LLM更新暂未实现]'
            }
          } else {
            updateFn = manager.simpleUpdateFunction.bind(manager)
          }

          // 更新文档
          const result = await manager.updateMagicDocs(docs, updateFn)

          return {
            content: JSON.stringify({
              success: true,
              action: 'update',
              directory,
              totalProcessed: result.totalProcessed,
              updated: result.updatedDocs.length,
              skipped: result.skippedDocs.length,
              errors: result.errors.length,
              stats: manager.getStats(),
              dry_run
            }, null, 2),
            isError: false
          }
        }

        case 'save': {
          // 保存更新的文档
          // 注意：需要先执行 update 操作
          const stats = manager.getStats()
          if (stats.updated === 0) {
            return {
              content: JSON.stringify({
                success: true,
                action: 'save',
                message: '没有需要保存的更新',
                stats
              }, null, 2),
              isError: false
            }
          }

          if (dry_run) {
            return {
              content: JSON.stringify({
                success: true,
                action: 'save',
                message: '试运行模式，未实际保存文件',
                would_save: stats.updated,
                dry_run: true
              }, null, 2),
              isError: false
            }
          }

          // 实际保存需要获取更新的文档列表
          // 这里简化处理，实际应该从 manager 中获取
          return {
            content: JSON.stringify({
              success: true,
              action: 'save',
              message: '保存功能需要完整的更新流程',
              note: '请先执行 update 操作，然后保存'
            }, null, 2),
            isError: false
          }
        }

        case 'stats': {
          const stats = manager.getStats()
          return {
            content: JSON.stringify({
              success: true,
              action: 'stats',
              stats,
              cache_size: stats.total
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
          error: error instanceof Error ? error.message : '未知错误',
          action: args.action
        }, null, 2),
        isError: true
      }
    }
  }
}