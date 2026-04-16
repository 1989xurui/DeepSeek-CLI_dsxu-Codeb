/**
 * Frontmatter Parser 测试
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseFrontmatter,
  parseFrontmatterFromFile,
  composeFrontmatter,
} from '../frontmatter-parser'

describe('Frontmatter Parser', () => {
  describe('parseFrontmatter', () => {
    it('正常解析 frontmatter', () => {
      const text = `---
title: 测试文档
tags: [test, frontmatter]
priority: 1
---
这是正文内容。`

      const result = parseFrontmatter(text)

      expect(result.hasFrontmatter).toBe(true)
      expect(result.frontmatter.title).toBe('测试文档')
      expect(result.frontmatter.tags).toEqual(['test', 'frontmatter'])
      expect(result.frontmatter.priority).toBe(1)
      expect(result.body.trim()).toBe('这是正文内容。')
      expect(result.error).toBeUndefined()
    })

    it('处理无 frontmatter 的文本', () => {
      const text = '这是普通文本，没有 frontmatter。'
      const result = parseFrontmatter(text)

      expect(result.hasFrontmatter).toBe(false)
      expect(Object.keys(result.frontmatter)).toHaveLength(0)
      expect(result.body).toBe(text)
    })

    it('处理非法 YAML（异常容错）', () => {
      const text = `---
title: 测试
invalid: yaml: with: colons
---
正文`

      const result = parseFrontmatter(text)

      // 应该能解析出有效的部分
      expect(result.hasFrontmatter).toBe(true)
      expect(result.frontmatter.title).toBe('测试')
      // 非法部分可能被解析为字符串
      expect(result.frontmatter.invalid).toBe('yaml: with: colons')
      expect(result.body.trim()).toBe('正文')
    })

    it('处理中文内容', () => {
      const text = `---
标题: 中文测试文档
标签: ["前端", "测试"]
日期: 2026-04-14
---
这是中文正文内容。`

      const result = parseFrontmatter(text)

      expect(result.hasFrontmatter).toBe(true)
      expect(result.frontmatter['标题']).toBe('中文测试文档')
      expect(result.frontmatter['标签']).toEqual(['前端', '测试'])
      expect(result.frontmatter['日期']).toBe('2026-04-14')
      expect(result.body.trim()).toBe('这是中文正文内容。')
    })

    it('处理空文本', () => {
      const result = parseFrontmatter('')
      expect(result.hasFrontmatter).toBe(false)
      expect(result.body).toBe('')
    })

    it('处理只有 frontmatter 分隔符的文本', () => {
      const text = `---
---
正文`
      const result = parseFrontmatter(text)
      expect(result.hasFrontmatter).toBe(false)
      expect(Object.keys(result.frontmatter)).toHaveLength(0)
      expect(result.body.trim()).toBe('正文')
    })

    it('处理未闭合的 frontmatter', () => {
      const text = `---
title: 测试
正文直接开始`
      const result = parseFrontmatter(text)
      expect(result.hasFrontmatter).toBe(false)
      expect(result.error).toBe('Frontmatter not properly closed')
      expect(result.body).toBe(text)
    })

    it('解析多行字符串', () => {
      const text = `---
description: |
  这是多行
  描述文本
  第三行
tags: [doc, test]
---
正文`
      const result = parseFrontmatter(text)
      expect(result.hasFrontmatter).toBe(true)
      expect(result.frontmatter.description).toBe('这是多行\n描述文本\n第三行')
      expect(result.frontmatter.tags).toEqual(['doc', 'test'])
    })

    it('解析折叠多行字符串', () => {
      const text = `---
summary: >
  这是折叠的
  多行文本
  会变成一行
---
正文`
      const result = parseFrontmatter(text)
      expect(result.hasFrontmatter).toBe(true)
      expect(result.frontmatter.summary).toBe('这是折叠的 多行文本 会变成一行')
    })
  })

  describe('parseFrontmatterFromFile', () => {
    it('处理文件读取失败（模拟）', async () => {
      // 由于无法在测试中实际读取文件，我们测试错误处理路径
      // 通过传递不存在的路径来触发错误
      const result = await parseFrontmatterFromFile('/path/to/nonexistent/file.md')
      expect(result.hasFrontmatter).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('composeFrontmatter', () => {
    it('组合 frontmatter 和 body', () => {
      const frontmatter = {
        title: '测试文档',
        tags: ['test', 'doc'],
        priority: 1,
        enabled: true
      }
      const body = '这是正文内容。'

      const result = composeFrontmatter(frontmatter, body)

      expect(result).toContain('---')
      expect(result).toContain('title: "测试文档"')
      expect(result).toContain('tags: ["test", "doc"]')
      expect(result).toContain('priority: 1')
      expect(result).toContain('enabled: true')
      expect(result).toContain('这是正文内容。')
    })

    it('处理多行字符串', () => {
      const frontmatter = {
        description: '第一行\n第二行\n第三行'
      }
      const body = '正文'

      const result = composeFrontmatter(frontmatter, body)
      expect(result).toContain('description: |')
      expect(result).toContain('  第一行')
      expect(result).toContain('  第二行')
      expect(result).toContain('  第三行')
    })

    it('处理空 frontmatter', () => {
      const result = composeFrontmatter({}, '正文')
      expect(result).toBe(`---
---
正文`)
    })

    it('处理 null/undefined 值', () => {
      const frontmatter = {
        title: '测试',
        optional: null,
        another: undefined
      }
      const result = composeFrontmatter(frontmatter, '正文')
      expect(result).toContain('title: "测试"')
      expect(result).toContain('optional: null')
      // undefined 应该被跳过
      expect(result).not.toContain('another')
    })
  })
})