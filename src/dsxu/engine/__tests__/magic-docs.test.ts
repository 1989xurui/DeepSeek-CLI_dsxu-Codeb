/**
 * Magic Docs 测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MagicDocsManager, createMagicDocsManager } from '../magic-docs'

describe('Magic Docs', () => {
  let manager: MagicDocsManager

  beforeEach(() => {
    manager = createMagicDocsManager()
  })

  afterEach(() => {
    manager.clearCache()
  })

  describe('parseMagicDoc', () => {
    it('识别 Magic Doc 标记', () => {
      const content = `# MAGIC DOC: 项目架构设计

这是项目架构设计文档。

## 概述
项目采用微服务架构。`

      const doc = manager.parseMagicDoc('/path/to/doc.md', content)

      expect(doc).not.toBeNull()
      expect(doc!.title).toBe('项目架构设计')
      expect(doc!.filePath).toBe('/path/to/doc.md')
      expect(doc!.originalContent).toBe(content)
      expect(doc!.isUpdated).toBe(false)
    })

    it('忽略没有 MAGIC DOC 标记的文档', () => {
      const content = `# 普通文档

这不是 Magic Doc。`

      const doc = manager.parseMagicDoc('/path/to/doc.md', content)
      expect(doc).toBeNull()
    })

    it('处理不同格式的 MAGIC DOC 标记', () => {
      const content1 = `# MAGIC DOC:测试标题`
      const content2 = `# MAGIC DOC: 测试标题`
      const content3 = `# MAGIC DOC : 测试标题`

      expect(manager.parseMagicDoc('/path/to/doc1.md', content1)?.title).toBe('测试标题')
      expect(manager.parseMagicDoc('/path/to/doc2.md', content2)?.title).toBe('测试标题')
      expect(manager.parseMagicDoc('/path/to/doc3.md', content3)?.title).toBe('测试标题')
    })
  })

  describe('updateMagicDoc', () => {
    it('更新文档内容', async () => {
      const content = `# MAGIC DOC: 测试文档
原始内容。`

      const doc = manager.parseMagicDoc('/path/to/doc.md', content)!

      const updateFn = vi.fn().mockResolvedValue(`# MAGIC DOC: 测试文档
原始内容。
最后更新：2026-04-14T00:00:00.000Z`)

      const updatedDoc = await manager.updateMagicDoc(doc, updateFn)

      expect(updatedDoc.isUpdated).toBe(true)
      expect(updatedDoc.updatedContent).toContain('最后更新：')
      expect(updateFn).toHaveBeenCalledWith(content)
    })

    it('幂等性：同输入重复执行结果一致', async () => {
      const content = `# MAGIC DOC: 测试文档
内容。`

      const doc = manager.parseMagicDoc('/path/to/doc.md', content)!
      const updateFn = vi.fn().mockResolvedValue(`# MAGIC DOC: 测试文档
内容。
已更新。`)

      // 第一次更新
      const updated1 = await manager.updateMagicDoc(doc, updateFn)
      expect(updated1.isUpdated).toBe(true)
      expect(updateFn).toHaveBeenCalledTimes(1)

      // 第二次更新（应该使用缓存）
      const updated2 = await manager.updateMagicDoc(doc, updateFn)
      expect(updated2.isUpdated).toBe(true)
      expect(updated2.updatedContent).toBe(updated1.updatedContent)
      expect(updateFn).toHaveBeenCalledTimes(1) // 应该没有再次调用
    })

    it('空输入保护', async () => {
      const content = ''
      const doc = manager.parseMagicDoc('/path/to/doc.md', content)

      // 空内容不应该被识别为 Magic Doc
      expect(doc).toBeNull()

      // 测试空输入保护需要先创建一个有效的doc
      const validContent = `# MAGIC DOC: 测试文档
内容。`
      const validDoc = manager.parseMagicDoc('/path/to/doc.md', validContent)!

      // 模拟空内容的情况
      const emptyDoc = {
        ...validDoc,
        originalContent: ''
      }

      const updateFn = vi.fn()
      const updatedDoc = await manager.updateMagicDoc(emptyDoc, updateFn)

      expect(updatedDoc.isUpdated).toBe(false)
      expect(updatedDoc.updateReason).toBe('empty_content')
      expect(updateFn).not.toHaveBeenCalled()
    })

    it('处理更新错误', async () => {
      const content = `# MAGIC DOC: 测试文档
内容。`

      const doc = manager.parseMagicDoc('/path/to/doc.md', content)!
      const updateFn = vi.fn().mockRejectedValue(new Error('更新失败'))

      const updatedDoc = await manager.updateMagicDoc(doc, updateFn)

      expect(updatedDoc.isUpdated).toBe(false)
      expect(updatedDoc.updateReason).toContain('error')
    })
  })

  describe('updateMagicDocs', () => {
    it('批量更新文档', async () => {
      const docs = [
        manager.parseMagicDoc('/path/to/doc1.md', `# MAGIC DOC: 文档1\n内容1`)!,
        manager.parseMagicDoc('/path/to/doc2.md', `# MAGIC DOC: 文档2\n内容2`)!,
      ]

      let callCount = 0
      const updateFn = vi.fn().mockImplementation((content: string) => {
        callCount++
        return Promise.resolve(content + `\n更新${callCount}`)
      })

      const result = await manager.updateMagicDocs(docs, updateFn)

      expect(result.totalProcessed).toBe(2)
      expect(result.updatedDocs).toHaveLength(2)
      expect(result.skippedDocs).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
      expect(updateFn).toHaveBeenCalledTimes(2)
    })

    it('处理批量更新中的错误', async () => {
      const docs = [
        manager.parseMagicDoc('/path/to/doc1.md', `# MAGIC DOC: 文档1\n内容1`)!,
        manager.parseMagicDoc('/path/to/doc2.md', `# MAGIC DOC: 文档2\n内容2`)!,
      ]

      const updateFn = vi.fn()
        .mockResolvedValueOnce('更新成功')
        .mockRejectedValueOnce(new Error('更新失败'))

      const result = await manager.updateMagicDocs(docs, updateFn)

      expect(result.totalProcessed).toBe(2)
      // 错误被捕获并记录在文档的updateReason中，不会抛出到errors数组
      expect(result.updatedDocs).toHaveLength(1)
      expect(result.skippedDocs).toHaveLength(1) // 第二个文档因为错误被跳过
      expect(result.errors).toHaveLength(0) // 错误被内部处理，不暴露到errors数组
    })
  })

  describe('simpleUpdateFunction', () => {
    it('添加更新时间戳', async () => {
      const content = `# MAGIC DOC: 测试文档
原始内容。`

      const updated = await manager.simpleUpdateFunction(content)

      expect(updated).toContain('最后更新：')
      expect(updated).toContain('原始内容。')
    })

    it('更新现有时间戳', async () => {
      const content = `# MAGIC DOC: 测试文档
原始内容。

最后更新：2026-01-01T00:00:00.000Z`

      const updated = await manager.simpleUpdateFunction(content)

      expect(updated).toContain('最后更新：')
      expect(updated).not.toContain('2026-01-01T00:00:00.000Z')
    })
  })

  describe('getStats', () => {
    it('获取处理统计', async () => {
      const docs = [
        manager.parseMagicDoc('/path/to/doc1.md', `# MAGIC DOC: 文档1\n内容1`)!,
        manager.parseMagicDoc('/path/to/doc2.md', `# MAGIC DOC: 文档2\n内容2`)!,
      ]

      const updateFn = vi.fn()
        .mockResolvedValueOnce('更新1')
        .mockResolvedValueOnce('更新2')

      await manager.updateMagicDocs(docs, updateFn)

      const stats = manager.getStats()

      expect(stats.total).toBe(2)
      expect(stats.updated).toBe(2)
      expect(stats.skipped).toBe(0)
      expect(stats.updateRate).toBe(1)
    })
  })
})