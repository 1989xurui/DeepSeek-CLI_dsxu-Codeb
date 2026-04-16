/**
 * Magic Docs - 自动维护标记文档
 *
 * 功能：
 * 1. 识别标记为 `# MAGIC DOC:` 的文档
 * 2. 自动更新文档内容（输入->输出稳定）
 * 3. 幂等性（同输入重复执行结果一致）
 * 4. 空输入保护
 */

export interface MagicDoc {
  /** 文档ID（基于文件路径和标题生成） */
  id: string
  /** 文件路径 */
  filePath: string
  /** 文档标题 */
  title: string
  /** 原始内容 */
  originalContent: string
  /** 更新后的内容 */
  updatedContent: string
  /** 是否已更新 */
  isUpdated: boolean
  /** 更新时间戳 */
  updatedAt: string
  /** 更新原因 */
  updateReason: string
}

export interface MagicDocUpdateResult {
  /** 更新的文档列表 */
  updatedDocs: MagicDoc[]
  /** 跳过的文档列表 */
  skippedDocs: MagicDoc[]
  /** 错误列表 */
  errors: Array<{ filePath: string; error: string }>
  /** 总处理文档数 */
  totalProcessed: number
}

/**
 * Magic Docs 管理器
 */
export class MagicDocsManager {
  private processedDocs = new Map<string, MagicDoc>()

  /**
   * 扫描目录中的 Magic Docs
   */
  async scanDirectory(dirPath: string): Promise<MagicDoc[]> {
    const docs: MagicDoc[] = []
    const fs = await import('fs/promises')
    const path = await import('path')

    try {
      const files = await this.readAllFiles(dirPath)

      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.rst')) {
          try {
            const content = await fs.readFile(file, 'utf-8')
            const doc = this.parseMagicDoc(file, content)
            if (doc) {
              docs.push(doc)
            }
          } catch (error) {
            // 忽略读取错误，继续处理其他文件
            console.warn(`Failed to read file ${file}:`, error)
          }
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dirPath}:`, error)
    }

    return docs
  }

  /**
   * 读取目录中的所有文件
   */
  private async readAllFiles(dirPath: string): Promise<string[]> {
    const fs = await import('fs/promises')
    const path = await import('path')
    const files: string[] = []

    async function readDir(currentPath: string) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
          // 跳过 node_modules、.git 等目录
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await readDir(fullPath)
          }
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    }

    await readDir(dirPath)
    return files
  }

  /**
   * 解析 Magic Doc
   */
  parseMagicDoc(filePath: string, content: string): MagicDoc | null {
    // 查找 MAGIC DOC 标记 - 更灵活的正则表达式
    const magicDocMatch = content.match(/^#\s*MAGIC\s*DOC\s*:\s*(.+)$/im)
    if (!magicDocMatch) {
      return null
    }

    const title = magicDocMatch[1].trim()
    const id = this.generateDocId(filePath, title)

    return {
      id,
      filePath,
      title,
      originalContent: content,
      updatedContent: content,
      isUpdated: false,
      updatedAt: new Date().toISOString(),
      updateReason: 'initial'
    }
  }

  /**
   * 生成文档ID
   */
  private generateDocId(filePath: string, title: string): string {
    const path = require('path')
    const crypto = require('crypto')

    const baseName = path.basename(filePath, path.extname(filePath))
    const hashInput = `${filePath}:${title}:${baseName}`
    const hash = crypto.createHash('md5').update(hashInput).digest('hex')

    return `magic_doc_${hash.slice(0, 8)}`
  }

  /**
   * 更新 Magic Doc
   */
  async updateMagicDoc(doc: MagicDoc, updateFn: (content: string) => Promise<string>): Promise<MagicDoc> {
    // 检查是否已经处理过（幂等性）
    const existing = this.processedDocs.get(doc.id)
    if (existing) {
      // 已经处理过，返回现有结果
      return existing
    }

    try {
      // 空输入保护
      if (!doc.originalContent || doc.originalContent.trim() === '') {
        const emptyDoc = {
          ...doc,
          isUpdated: false,
          updateReason: 'empty_content'
        }
        this.processedDocs.set(doc.id, emptyDoc)
        return emptyDoc
      }

      // 调用更新函数
      const updatedContent = await updateFn(doc.originalContent)

      // 检查内容是否实际变化
      const isUpdated = updatedContent !== doc.originalContent

      const updatedDoc: MagicDoc = {
        ...doc,
        updatedContent,
        isUpdated,
        updatedAt: new Date().toISOString(),
        updateReason: isUpdated ? 'content_updated' : 'no_changes'
      }

      // 缓存结果
      this.processedDocs.set(doc.id, updatedDoc)

      return updatedDoc
    } catch (error) {
      console.error(`Failed to update magic doc ${doc.filePath}:`, error)
      const errorDoc = {
        ...doc,
        isUpdated: false,
        updateReason: `error: ${error instanceof Error ? error.message : 'unknown'}`
      }
      this.processedDocs.set(doc.id, errorDoc)
      return errorDoc
    }
  }

  /**
   * 批量更新 Magic Docs
   */
  async updateMagicDocs(
    docs: MagicDoc[],
    updateFn: (content: string) => Promise<string>
  ): Promise<MagicDocUpdateResult> {
    const updatedDocs: MagicDoc[] = []
    const skippedDocs: MagicDoc[] = []
    const errors: Array<{ filePath: string; error: string }> = []

    for (const doc of docs) {
      try {
        const updatedDoc = await this.updateMagicDoc(doc, updateFn)

        if (updatedDoc.isUpdated) {
          updatedDocs.push(updatedDoc)
        } else {
          skippedDocs.push(updatedDoc)
        }
      } catch (error) {
        errors.push({
          filePath: doc.filePath,
          error: error instanceof Error ? error.message : 'unknown error'
        })
      }
    }

    return {
      updatedDocs,
      skippedDocs,
      errors,
      totalProcessed: docs.length
    }
  }

  /**
   * 保存更新的文档到文件
   */
  async saveUpdatedDocs(updatedDocs: MagicDoc[]): Promise<Array<{ filePath: string; success: boolean; error?: string }>> {
    const fs = await import('fs/promises')
    const results: Array<{ filePath: string; success: boolean; error?: string }> = []

    for (const doc of updatedDocs) {
      if (!doc.isUpdated) {
        continue
      }

      try {
        await fs.writeFile(doc.filePath, doc.updatedContent, 'utf-8')
        results.push({
          filePath: doc.filePath,
          success: true
        })
      } catch (error) {
        results.push({
          filePath: doc.filePath,
          success: false,
          error: error instanceof Error ? error.message : 'unknown error'
        })
      }
    }

    return results
  }

  /**
   * 简单的文档更新函数示例
   * 在实际使用中，这个函数应该调用 LLM 来更新文档
   */
  async simpleUpdateFunction(content: string): Promise<string> {
    // 这是一个示例更新函数
    // 在实际使用中，这里应该调用 LLM 来分析和更新文档

    // 简单的更新：确保文档有最后更新时间戳
    const now = new Date().toISOString()

    // 检查是否已经有更新时间戳
    if (content.includes('最后更新：')) {
      // 更新现有的时间戳
      return content.replace(/最后更新：\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, `最后更新：${now}`)
    } else {
      // 添加新的时间戳
      return content + `\n\n最后更新：${now}`
    }
  }

  /**
   * 获取处理统计
   */
  getStats() {
    const total = this.processedDocs.size
    const updated = Array.from(this.processedDocs.values()).filter(d => d.isUpdated).length
    const skipped = total - updated

    return {
      total,
      updated,
      skipped,
      updateRate: total > 0 ? (updated / total) : 0
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.processedDocs.clear()
  }
}

/**
 * 创建 Magic Docs 管理器实例
 */
export function createMagicDocsManager(): MagicDocsManager {
  return new MagicDocsManager()
}