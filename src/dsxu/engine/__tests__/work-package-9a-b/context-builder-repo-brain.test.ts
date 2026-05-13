import { describe, it, expect } from 'bun:test'
import {
  createContextBundle,
  serializeContextBundle,
  deserializeContextBundle,
  type ContextBundle
} from '../../context-builder'
import {
  createRepoBrainBundle,
  createRepoMapNode,
  createSymbolDefinition,
  createDependencyRelation,
  createHotspotArea,
  type RepoBrainInput,
  type RepoBrainBundle
} from '../../repo-brain'

describe('9A-B: Repo Brain 接入 Context Builder 验证', () => {
  describe('测试1：Context Bundle 可挂载 Repo Brain', () => {
    it('createContextBundle() 应该接收并包含 repoBrain 参数', () => {
      // 创建最小 Repo Brain bundle
      const repoBrainConfig: RepoBrainInput = {
        repoRoot: '/test/repo',
        analyzeSymbols: false,
        analyzeDependencies: false,
        detectHotspots: false
      }
      const repoBrain = createRepoBrainBundle(repoBrainConfig)

      // 创建带有 repoBrain 的 Context Bundle
      const contextBundle = createContextBundle(
        'test-task-001',
        '测试任务描述',
        {}, // 默认 tokenBudget
        repoBrain
      )

      // 验证返回结果中存在 repoBrain
      expect(contextBundle.repoBrain).toBeDefined()
      expect(contextBundle.repoBrain).toBe(repoBrain)

      // 验证 repoBrain 至少包含必需字段
      const rb = contextBundle.repoBrain!
      expect(rb.repoMap).toBeDefined()
      expect(rb.symbols).toBeDefined()
      expect(rb.dependencies).toBeDefined()
      expect(rb.hotspots).toBeDefined()

      // 验证字段类型
      expect(Array.isArray(rb.repoMap)).toBe(true)
      expect(Array.isArray(rb.symbols)).toBe(true)
      expect(Array.isArray(rb.dependencies)).toBe(true)
      expect(Array.isArray(rb.hotspots)).toBe(true)

      console.log('Context Bundle 挂载 Repo Brain 验证:', {
        taskId: contextBundle.taskId,
        hasRepoBrain: !!contextBundle.repoBrain,
        repoMapCount: rb.repoMap.length,
        symbolsCount: rb.symbols.length,
        dependenciesCount: rb.dependencies.length,
        hotspotsCount: rb.hotspots.length
      })
    })

    it('createContextBundle() 可不传 repoBrain 参数', () => {
      // 创建不带 repoBrain 的 Context Bundle
      const contextBundle = createContextBundle(
        'test-task-002',
        '另一个测试任务'
      )

      // 验证 repoBrain 是可选的
      expect(contextBundle.repoBrain).toBeUndefined()

      // 验证其他字段正常
      expect(contextBundle.taskId).toBe('test-task-002')
      expect(contextBundle.query).toBe('另一个测试任务')
      expect(contextBundle.repoMap).toEqual([])
      expect(contextBundle.symbols).toEqual([])
      expect(contextBundle.dependencies).toEqual([])
    })
  })

  describe('测试2：Repo Brain 结构完整透传', () => {
    it('repoRoot 和 config 应正确保留', () => {
      // 创建包含数据的 Repo Brain bundle
      const repoBrainConfig: RepoBrainInput = {
        repoRoot: '/custom/repo/path',
        includeHidden: true,
        excludePatterns: ['node_modules', '.git'],
        includeExtensions: ['.ts', '.js'],
        maxFileSize: 1024 * 1024,
        analyzeSymbols: true,
        analyzeDependencies: true,
        detectHotspots: true,
        depthLimit: 5
      }

      // 添加一些示例数据
      const repoMapNode = createRepoMapNode({
        path: 'src/index.ts',
        type: 'file',
        extension: '.ts',
        size: 1024,
        lastModified: Date.now(),
        selected: true,
        importanceScore: 90
      })

      const symbolDef = createSymbolDefinition({
        name: 'mainFunction',
        type: 'function',
        filePath: 'src/main.ts',
        line: 10,
        column: 5,
        visibility: 'public',
        description: '主函数',
        signature: '(): void'
      })

      const dependencyRel = createDependencyRelation({
        sourcePath: 'src/app.ts',
        targetPath: 'src/utils.ts',
        type: 'import',
        strength: 80,
        isCyclic: false,
        description: '导入工具模块'
      })

      const hotspotArea = createHotspotArea({
        id: 'complex-area-001',
        type: 'complex',
        filePaths: ['src/core.ts', 'src/logic.ts'],
        description: '复杂业务逻辑区域',
        severity: 7,
        confidence: 85,
        suggestions: ['考虑重构', '添加注释']
      })

      // 创建自定义 Repo Brain bundle
      const customRepoBrain: RepoBrainBundle = {
        repoMap: [repoMapNode],
        symbols: [symbolDef],
        dependencies: [dependencyRel],
        hotspots: [hotspotArea],
        selectedFiles: ['src/index.ts', 'src/main.ts'],
        entryPoints: ['src/index.ts'],
        notes: ['自定义分析备注', '包含示例数据'],
        generatedAt: Date.now(),
        repoRoot: repoBrainConfig.repoRoot,
        config: repoBrainConfig
      }

      // 创建带有自定义 Repo Brain 的 Context Bundle
      const contextBundle = createContextBundle(
        'test-task-003',
        '测试完整结构透传',
        { inputBudget: 10000 },
        customRepoBrain
      )

      // 验证 repoBrain 存在
      expect(contextBundle.repoBrain).toBeDefined()
      const rb = contextBundle.repoBrain!

      // 验证 repoRoot 正确保留
      expect(rb.repoRoot).toBe('/custom/repo/path')
      expect(rb.config.repoRoot).toBe('/custom/repo/path')

      // 验证 config 正确保留
      expect(rb.config.includeHidden).toBe(true)
      expect(rb.config.excludePatterns).toEqual(['node_modules', '.git'])
      expect(rb.config.includeExtensions).toEqual(['.ts', '.js'])
      expect(rb.config.maxFileSize).toBe(1024 * 1024)
      expect(rb.config.analyzeSymbols).toBe(true)
      expect(rb.config.analyzeDependencies).toBe(true)
      expect(rb.config.detectHotspots).toBe(true)
      expect(rb.config.depthLimit).toBe(5)

      // 验证扩展字段可被携带
      expect(rb.selectedFiles).toEqual(['src/index.ts', 'src/main.ts'])
      expect(rb.entryPoints).toEqual(['src/index.ts'])
      expect(rb.notes).toContain('自定义分析备注')
      expect(rb.notes).toContain('包含示例数据')

      // 验证 generatedAt 存在
      expect(rb.generatedAt).toBeGreaterThan(0)
      expect(rb.generatedAt).toBeLessThanOrEqual(Date.now())

      // 验证数据数组结构完整
      expect(rb.repoMap.length).toBe(1)
      expect(rb.symbols.length).toBe(1)
      expect(rb.dependencies.length).toBe(1)
      expect(rb.hotspots.length).toBe(1)

      console.log('Repo Brain 结构完整透传验证:', {
        repoRoot: rb.repoRoot,
        selectedFilesCount: rb.selectedFiles.length,
        entryPointsCount: rb.entryPoints.length,
        notesCount: rb.notes.length,
        dataCounts: {
          repoMap: rb.repoMap.length,
          symbols: rb.symbols.length,
          dependencies: rb.dependencies.length,
          hotspots: rb.hotspots.length
        }
      })
    })
  })

  describe('测试3：序列化/反序列化后 Repo Brain 不丢失', () => {
    it('序列化/反序列化后 repoBrain 关键字段仍存在', () => {
      // 创建包含数据的 Repo Brain bundle
      const repoBrainConfig: RepoBrainInput = {
        repoRoot: '/serialization/test',
        analyzeSymbols: true,
        analyzeDependencies: false,
        detectHotspots: true
      }

      const repoBrain = createRepoBrainBundle(repoBrainConfig)

      // 添加一些数据
      const enhancedRepoBrain: RepoBrainBundle = {
        ...repoBrain,
        repoMap: [
          createRepoMapNode({
            path: 'package.json',
            type: 'file',
            extension: '.json',
            size: 512,
            selected: true
          })
        ],
        symbols: [
          createSymbolDefinition({
            name: 'Config',
            type: 'interface',
            filePath: 'src/types.ts',
            line: 15,
            description: '配置接口'
          })
        ],
        dependencies: [
          createDependencyRelation({
            sourcePath: 'src/app.ts',
            targetPath: 'src/lib.ts',
            type: 'import',
            strength: 60
          })
        ],
        hotspots: [
          createHotspotArea({
            id: 'hotspot-serial-001',
            type: 'critical',
            filePaths: ['src/auth.ts'],
            description: '认证关键路径',
            severity: 9
          })
        ],
        selectedFiles: ['package.json', 'src/types.ts'],
        entryPoints: ['src/index.ts'],
        notes: ['序列化测试数据']
      }

      // 创建 Context Bundle
      const originalBundle = createContextBundle(
        'serial-test-001',
        '序列化测试任务',
        {},
        enhancedRepoBrain
      )

      // 序列化
      const serialized = serializeContextBundle(originalBundle)
      expect(typeof serialized).toBe('string')
      expect(serialized.length).toBeGreaterThan(0)

      // 反序列化
      const deserialized = deserializeContextBundle(serialized)

      // 验证反序列化后的 bundle 包含 repoBrain
      expect(deserialized.repoBrain).toBeDefined()
      const deserializedRepoBrain = deserialized.repoBrain!

      // 验证关键字段存在
      expect(deserializedRepoBrain.repoRoot).toBe('/serialization/test')
      expect(deserializedRepoBrain.generatedAt).toBeGreaterThan(0)

      // 验证 config 正确保留
      expect(deserializedRepoBrain.config.repoRoot).toBe('/serialization/test')
      expect(deserializedRepoBrain.config.analyzeSymbols).toBe(true)
      expect(deserializedRepoBrain.config.analyzeDependencies).toBe(false)
      expect(deserializedRepoBrain.config.detectHotspots).toBe(true)

      // 验证数组结构不丢失
      expect(Array.isArray(deserializedRepoBrain.repoMap)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.symbols)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.dependencies)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.hotspots)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.selectedFiles)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.entryPoints)).toBe(true)
      expect(Array.isArray(deserializedRepoBrain.notes)).toBe(true)

      // 验证数据内容
      expect(deserializedRepoBrain.repoMap.length).toBe(1)
      expect(deserializedRepoBrain.repoMap[0].path).toBe('package.json')
      expect(deserializedRepoBrain.repoMap[0].type).toBe('file')

      expect(deserializedRepoBrain.symbols.length).toBe(1)
      expect(deserializedRepoBrain.symbols[0].name).toBe('Config')
      expect(deserializedRepoBrain.symbols[0].type).toBe('interface')

      expect(deserializedRepoBrain.dependencies.length).toBe(1)
      expect(deserializedRepoBrain.dependencies[0].type).toBe('import')

      expect(deserializedRepoBrain.hotspots.length).toBe(1)
      expect(deserializedRepoBrain.hotspots[0].id).toBe('hotspot-serial-001')
      expect(deserializedRepoBrain.hotspots[0].type).toBe('critical')

      expect(deserializedRepoBrain.selectedFiles).toContain('package.json')
      expect(deserializedRepoBrain.selectedFiles).toContain('src/types.ts')
      expect(deserializedRepoBrain.entryPoints).toContain('src/index.ts')
      expect(deserializedRepoBrain.notes).toContain('序列化测试数据')

      console.log('序列化/反序列化验证:', {
        originalHasRepoBrain: !!originalBundle.repoBrain,
        deserializedHasRepoBrain: !!deserialized.repoBrain,
        serializedLength: serialized.length,
        dataPreserved: {
          repoMap: deserializedRepoBrain.repoMap.length === enhancedRepoBrain.repoMap.length,
          symbols: deserializedRepoBrain.symbols.length === enhancedRepoBrain.symbols.length,
          dependencies: deserializedRepoBrain.dependencies.length === enhancedRepoBrain.dependencies.length,
          hotspots: deserializedRepoBrain.hotspots.length === enhancedRepoBrain.hotspots.length
        }
      })
    })

    it('不包含 repoBrain 的 bundle 序列化/反序列化后仍有效', () => {
      // 创建不带 repoBrain 的 Context Bundle
      const originalBundle = createContextBundle(
        'no-repobrain-test',
        '无 Repo Brain 测试'
      )

      // 验证原始 bundle 没有 repoBrain
      expect(originalBundle.repoBrain).toBeUndefined()

      // 序列化
      const serialized = serializeContextBundle(originalBundle)

      // 反序列化
      const deserialized = deserializeContextBundle(serialized)

      // 验证反序列化后的 bundle 也没有 repoBrain
      expect(deserialized.repoBrain).toBeUndefined()

      // 验证其他字段正确
      expect(deserialized.taskId).toBe('no-repobrain-test')
      expect(deserialized.query).toBe('无 Repo Brain 测试')
      expect(deserialized.repoMap).toEqual([])
      expect(deserialized.symbols).toEqual([])
      expect(deserialized.dependencies).toEqual([])
    })
  })
})
