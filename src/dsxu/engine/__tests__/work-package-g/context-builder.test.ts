import { describe, it, expect } from 'bun:test'
import {
  createContextBundle,
  updateTokenUsage,
  hasSufficientTokenBudget,
  getRemainingTokenBudget,
  addFileToRepoMap,
  addSymbol,
  addDependency,
  addNote,
  selectFile,
  serializeContextBundle,
  deserializeContextBundle,
  type ContextBundle
} from '../../context-builder'

describe('Context Builder - Work Package G', () => {
  describe('1. createContextBundle 能创建最小 bundle', () => {
    it('应该创建包含所有必需字段的上下文包', () => {
      const taskId = 'test-task-123'
      const query = '测试查询内容'

      const bundle = createContextBundle(taskId, query)

      // 验证必需字段
      expect(bundle.taskId).toBe(taskId)
      expect(bundle.query).toBe(query)
      expect(bundle.repoMap).toBeDefined()
      expect(Array.isArray(bundle.repoMap)).toBe(true)
      expect(bundle.symbols).toBeDefined()
      expect(Array.isArray(bundle.symbols)).toBe(true)
      expect(bundle.dependencies).toBeDefined()
      expect(Array.isArray(bundle.dependencies)).toBe(true)
      expect(bundle.tokenBudget).toBeDefined()
      expect(bundle.generatedAt).toBeDefined()
      expect(typeof bundle.generatedAt).toBe('number')
      expect(bundle.generatedAt).toBeGreaterThan(0)

      // 验证预留字段
      expect(bundle.selectedFiles).toBeDefined()
      expect(Array.isArray(bundle.selectedFiles)).toBe(true)
      expect(bundle.notes).toBeDefined()
      expect(Array.isArray(bundle.notes)).toBe(true)
      expect(bundle.version).toBeDefined()
      expect(typeof bundle.version).toBe('string')
    })
  })

  describe('2. tokenBudget 结构正确', () => {
    it('应该使用默认令牌预算值', () => {
      const bundle = createContextBundle('test', 'query')

      expect(bundle.tokenBudget.inputBudget).toBe(8000)
      expect(bundle.tokenBudget.reservedOutput).toBe(2000)
      expect(bundle.tokenBudget.totalLimit).toBe(10000)
      expect(bundle.tokenBudget.usedInput).toBe(0)
      expect(bundle.tokenBudget.usedOutput).toBe(0)
    })

    it('应该接受自定义令牌预算', () => {
      const customBudget = {
        inputBudget: 5000,
        reservedOutput: 1000,
        totalLimit: 6000,
        usedInput: 100,
        usedOutput: 50
      }

      const bundle = createContextBundle('test', 'query', customBudget)

      expect(bundle.tokenBudget.inputBudget).toBe(5000)
      expect(bundle.tokenBudget.reservedOutput).toBe(1000)
      expect(bundle.tokenBudget.totalLimit).toBe(6000)
      expect(bundle.tokenBudget.usedInput).toBe(100)
      expect(bundle.tokenBudget.usedOutput).toBe(50)
    })

    it('应该合并默认值和自定义值', () => {
      const partialBudget = {
        inputBudget: 12000,
        usedInput: 500
      }

      const bundle = createContextBundle('test', 'query', partialBudget)

      expect(bundle.tokenBudget.inputBudget).toBe(12000) // 自定义
      expect(bundle.tokenBudget.reservedOutput).toBe(2000) // 默认
      expect(bundle.tokenBudget.totalLimit).toBe(10000) // 默认
      expect(bundle.tokenBudget.usedInput).toBe(500) // 自定义
      expect(bundle.tokenBudget.usedOutput).toBe(0) // 默认
    })
  })

  describe('3. 空结构可安全初始化', () => {
    it('所有数组字段应该初始化为空数组', () => {
      const bundle = createContextBundle('test', 'query')

      expect(bundle.repoMap).toEqual([])
      expect(bundle.symbols).toEqual([])
      expect(bundle.dependencies).toEqual([])
      expect(bundle.selectedFiles).toEqual([])
      expect(bundle.notes).toEqual([])
    })

    it('空数组应该可以安全操作', () => {
      const bundle = createContextBundle('test', 'query')

      // 测试数组方法不会抛出错误
      expect(() => bundle.repoMap.map(item => item)).not.toThrow()
      expect(() => bundle.symbols.filter(s => s)).not.toThrow()
      expect(() => bundle.dependencies.slice()).not.toThrow()
      expect(() => bundle.selectedFiles.concat(['test'])).not.toThrow()
      expect(() => bundle.notes.push('note')).not.toThrow()
    })
  })

  describe('4. 基础辅助函数有效', () => {
    it('updateTokenUsage 应该更新令牌使用情况', () => {
      const bundle = createContextBundle('test', 'query')

      const updated = updateTokenUsage(bundle, 100, 50)

      expect(updated.tokenBudget.usedInput).toBe(100)
      expect(updated.tokenBudget.usedOutput).toBe(50)

      // 再次更新应该累加
      const updated2 = updateTokenUsage(updated, 200, 100)
      expect(updated2.tokenBudget.usedInput).toBe(300)
      expect(updated2.tokenBudget.usedOutput).toBe(150)
    })

    it('hasSufficientTokenBudget 应该检查预算是否充足', () => {
      const bundle = createContextBundle('test', 'query')

      // 初始状态应该有充足预算
      expect(hasSufficientTokenBudget(bundle)).toBe(true)

      // 使用部分预算后应该仍然充足
      const usedBundle = updateTokenUsage(bundle, 4000, 1000)
      expect(hasSufficientTokenBudget(usedBundle)).toBe(true)

      // 超出预算应该返回false
      const overusedBundle = updateTokenUsage(bundle, 9000, 3000)
      expect(hasSufficientTokenBudget(overusedBundle)).toBe(false)
    })

    it('getRemainingTokenBudget 应该计算剩余预算', () => {
      const bundle = createContextBundle('test', 'query')

      const remaining = getRemainingTokenBudget(bundle)
      expect(remaining.remainingInput).toBe(8000)
      expect(remaining.remainingOutput).toBe(2000)
      expect(remaining.remainingTotal).toBe(10000)

      const usedBundle = updateTokenUsage(bundle, 3000, 500)
      const remainingUsed = getRemainingTokenBudget(usedBundle)
      expect(remainingUsed.remainingInput).toBe(5000) // 8000 - 3000
      expect(remainingUsed.remainingOutput).toBe(1500) // 2000 - 500
      expect(remainingUsed.remainingTotal).toBe(6500) // 10000 - 3500
    })

    it('addFileToRepoMap 应该添加文件到仓库映射', () => {
      const bundle = createContextBundle('test', 'query')

      const filePath = '/src/test.ts'
      const fileContent = 'console.log("test")'

      const updated = addFileToRepoMap(bundle, filePath, fileContent)

      expect(updated.repoMap).toHaveLength(1)
      expect(updated.repoMap[0].path).toBe(filePath)
      expect(updated.repoMap[0].content).toBe(fileContent)
      expect(updated.repoMap[0].size).toBe(fileContent.length)
      expect(updated.repoMap[0].type).toBe('file')
      expect(updated.repoMap[0].selected).toBe(false)

      // 更新现有文件
      const newContent = 'console.log("updated")'
      const updated2 = addFileToRepoMap(updated, filePath, newContent)
      expect(updated2.repoMap).toHaveLength(1) // 仍然是1个文件
      expect(updated2.repoMap[0].content).toBe(newContent)
      expect(updated2.repoMap[0].size).toBe(newContent.length)
    })

    it('addSymbol 应该添加符号信息', () => {
      const bundle = createContextBundle('test', 'query')

      const symbol = {
        name: 'TestClass',
        type: 'class',
        location: 'src/test.ts:10',
        documentation: '测试类',
        signature: 'class TestClass {}'
      }

      const updated = addSymbol(bundle, symbol)

      expect(updated.symbols).toHaveLength(1)
      expect(updated.symbols[0].name).toBe('TestClass')
      expect(updated.symbols[0].type).toBe('class')
      expect(updated.symbols[0].location).toBe('src/test.ts:10')
      expect(updated.symbols[0].documentation).toBe('测试类')
      expect(updated.symbols[0].signature).toBe('class TestClass {}')
    })

    it('addDependency 应该添加依赖项信息', () => {
      const bundle = createContextBundle('test', 'query')

      const dependency = {
        name: 'react',
        version: '18.2.0',
        type: 'production' as const
      }

      const updated = addDependency(bundle, dependency)

      expect(updated.dependencies).toHaveLength(1)
      expect(updated.dependencies[0].name).toBe('react')
      expect(updated.dependencies[0].version).toBe('18.2.0')
      expect(updated.dependencies[0].type).toBe('production')
      expect(updated.dependencies[0].inPackageJson).toBe(true)
      expect(updated.dependencies[0].installed).toBe(true)
    })

    it('addNote 应该添加备注', () => {
      const bundle = createContextBundle('test', 'query')

      const note1 = '这是第一条备注'
      const note2 = '这是第二条备注'

      const updated1 = addNote(bundle, note1)
      expect(updated1.notes).toEqual([note1])

      const updated2 = addNote(updated1, note2)
      expect(updated2.notes).toEqual([note1, note2])
    })

    it('selectFile 应该选择文件并更新标志', () => {
      // 先添加文件
      let bundle = createContextBundle('test', 'query')
      bundle = addFileToRepoMap(bundle, '/src/file1.ts', 'content1')
      bundle = addFileToRepoMap(bundle, '/src/file2.ts', 'content2')

      // 选择文件
      const updated = selectFile(bundle, '/src/file1.ts')

      expect(updated.selectedFiles).toEqual(['/src/file1.ts'])
      expect(updated.repoMap.find(f => f.path === '/src/file1.ts')?.selected).toBe(true)
      expect(updated.repoMap.find(f => f.path === '/src/file2.ts')?.selected).toBe(false)

      // 再次选择同一个文件不应该重复添加
      const updated2 = selectFile(updated, '/src/file1.ts')
      expect(updated2.selectedFiles).toEqual(['/src/file1.ts']) // 仍然是1个
    })
  })

  describe('5. serialize / deserialize', () => {
    it('应该正确序列化和反序列化上下文包', () => {
      // 创建包含各种数据的bundle
      let bundle = createContextBundle('serialize-test', '测试序列化')
      bundle = addFileToRepoMap(bundle, '/test.ts', 'const x = 1')
      bundle = addSymbol(bundle, {
        name: 'x',
        type: 'variable',
        location: '/test.ts:1'
      })
      bundle = addDependency(bundle, {
        name: 'typescript',
        version: '5.0.0',
        type: 'development'
      })
      bundle = addNote(bundle, '测试备注')
      bundle = selectFile(bundle, '/test.ts')
      bundle = updateTokenUsage(bundle, 100, 50)

      // 序列化
      const json = serializeContextBundle(bundle)
      expect(typeof json).toBe('string')
      expect(json).toContain('serialize-test')
      expect(json).toContain('测试序列化')

      // 反序列化
      const deserialized = deserializeContextBundle(json)

      // 验证关键字段不丢失
      expect(deserialized.taskId).toBe(bundle.taskId)
      expect(deserialized.query).toBe(bundle.query)
      expect(deserialized.repoMap).toHaveLength(1)
      expect(deserialized.repoMap[0].path).toBe('/test.ts')
      expect(deserialized.repoMap[0].content).toBe('const x = 1')
      expect(deserialized.symbols).toHaveLength(1)
      expect(deserialized.symbols[0].name).toBe('x')
      expect(deserialized.dependencies).toHaveLength(1)
      expect(deserialized.dependencies[0].name).toBe('typescript')
      expect(deserialized.tokenBudget.usedInput).toBe(100)
      expect(deserialized.tokenBudget.usedOutput).toBe(50)
      expect(deserialized.selectedFiles).toEqual(['/test.ts'])
      expect(deserialized.notes).toEqual(['测试备注'])
      expect(deserialized.generatedAt).toBe(bundle.generatedAt)
      expect(deserialized.version).toBe(bundle.version)
    })

    it('应该处理不完整JSON的反序列化', () => {
      const incompleteJson = '{"taskId":"test","query":"query"}'

      const deserialized = deserializeContextBundle(incompleteJson)

      expect(deserialized.taskId).toBe('test')
      expect(deserialized.query).toBe('query')
      expect(deserialized.repoMap).toEqual([])
      expect(deserialized.symbols).toEqual([])
      expect(deserialized.dependencies).toEqual([])
      expect(deserialized.tokenBudget.inputBudget).toBe(8000) // 默认值
      expect(deserialized.selectedFiles).toEqual([])
      expect(deserialized.notes).toEqual([])
      expect(deserialized.generatedAt).toBeGreaterThan(0)
      expect(deserialized.version).toBe('1.0.0')
    })
  })
})
