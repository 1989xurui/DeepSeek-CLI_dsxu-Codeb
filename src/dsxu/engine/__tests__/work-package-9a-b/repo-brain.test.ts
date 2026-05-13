import { describe, it, expect } from 'bun:test'
import {
  createRepoBrainBundle,
  createRepoMapNode,
  createSymbolDefinition,
  createDependencyRelation,
  createHotspotArea,
  type RepoBrainInput,
  type RepoBrainBundle,
  type RepoMapNode,
  type SymbolDefinition,
  type DependencyRelation,
  type HotspotArea
} from '../../repo-brain'

describe('9A-B: Repo Brain 核心结构定义验证', () => {
  describe('1. createRepoBrainBundle 能创建最小 bundle', () => {
    it('应该创建包含所有必需字段的最小 bundle', () => {
      const config: RepoBrainInput = {
        repoRoot: '/path/to/repo',
        includeHidden: false,
        excludePatterns: ['node_modules', '.git'],
        includeExtensions: ['.ts', '.js', '.json'],
        maxFileSize: 1024 * 1024, // 1MB
        analyzeSymbols: false,
        analyzeDependencies: false,
        detectHotspots: false,
        depthLimit: 3
      }

      const bundle = createRepoBrainBundle(config)

      // 验证必需字段存在
      expect(bundle).toBeDefined()
      expect(bundle.repoMap).toBeDefined()
      expect(bundle.symbols).toBeDefined()
      expect(bundle.dependencies).toBeDefined()
      expect(bundle.hotspots).toBeDefined()
      expect(bundle.selectedFiles).toBeDefined()
      expect(bundle.entryPoints).toBeDefined()
      expect(bundle.notes).toBeDefined()
      expect(bundle.generatedAt).toBeDefined()
      expect(bundle.repoRoot).toBeDefined()
      expect(bundle.config).toBeDefined()

      // 验证字段类型
      expect(Array.isArray(bundle.repoMap)).toBe(true)
      expect(Array.isArray(bundle.symbols)).toBe(true)
      expect(Array.isArray(bundle.dependencies)).toBe(true)
      expect(Array.isArray(bundle.hotspots)).toBe(true)
      expect(Array.isArray(bundle.selectedFiles)).toBe(true)
      expect(Array.isArray(bundle.entryPoints)).toBe(true)
      expect(Array.isArray(bundle.notes)).toBe(true)
      expect(typeof bundle.generatedAt).toBe('number')
      expect(typeof bundle.repoRoot).toBe('string')
      expect(typeof bundle.config).toBe('object')

      // 验证时间戳合理
      expect(bundle.generatedAt).toBeGreaterThan(0)
      expect(bundle.generatedAt).toBeLessThanOrEqual(Date.now())

      console.log('创建的最小 bundle:', {
        repoRoot: bundle.repoRoot,
        generatedAt: new Date(bundle.generatedAt).toISOString(),
        repoMapCount: bundle.repoMap.length,
        symbolsCount: bundle.symbols.length,
        dependenciesCount: bundle.dependencies.length,
        hotspotsCount: bundle.hotspots.length,
        notes: bundle.notes
      })
    })
  })

  describe('2. 四类核心结构可安全初始化', () => {
    it('repoMap 初始可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.repoMap).toEqual([])
      expect(bundle.repoMap.length).toBe(0)
    })

    it('symbols 初始可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.symbols).toEqual([])
      expect(bundle.symbols.length).toBe(0)
    })

    it('dependencies 初始可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.dependencies).toEqual([])
      expect(bundle.dependencies.length).toBe(0)
    })

    it('hotspots 初始可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.hotspots).toEqual([])
      expect(bundle.hotspots.length).toBe(0)
    })
  })

  describe('3. 预留字段可安全初始化', () => {
    it('selectedFiles 可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.selectedFiles).toEqual([])
      expect(bundle.selectedFiles.length).toBe(0)
    })

    it('entryPoints 可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.entryPoints).toEqual([])
      expect(bundle.entryPoints.length).toBe(0)
    })

    it('notes 可为空数组', () => {
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)

      expect(Array.isArray(bundle.notes)).toBe(true)
      expect(bundle.notes.length).toBeGreaterThan(0) // 应该有默认备注
      expect(bundle.notes[0]).toContain('9A-B')
    })
  })

  describe('4. 辅助创建函数有效', () => {
    it('createRepoMapNode() 应该创建完整的 RepoMapNode', () => {
      const node = createRepoMapNode({
        path: 'src/index.ts',
        type: 'file',
        extension: '.ts',
        size: 1024,
        lastModified: Date.now(),
        selected: true,
        importanceScore: 80
      })

      // 验证必需字段
      expect(node.path).toBe('src/index.ts')
      expect(node.type).toBe('file')
      expect(node.extension).toBe('.ts')
      expect(node.size).toBe(1024)
      expect(node.lastModified).toBeGreaterThan(0)
      expect(node.selected).toBe(true)
      expect(node.importanceScore).toBe(80)

      // 验证可放入 repoMap 数组
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)
      const updatedBundle: RepoBrainBundle = {
        ...bundle,
        repoMap: [...bundle.repoMap, node]
      }

      expect(updatedBundle.repoMap.length).toBe(1)
      expect(updatedBundle.repoMap[0]).toBe(node)

      console.log('创建的 RepoMapNode:', node)
    })

    it('createSymbolDefinition() 应该创建完整的 SymbolDefinition', () => {
      const symbol = createSymbolDefinition({
        name: 'calculateTotal',
        type: 'function',
        filePath: 'src/math.ts',
        line: 42,
        column: 10,
        visibility: 'public',
        description: '计算总和',
        signature: '(a: number, b: number): number'
      })

      // 验证必需字段
      expect(symbol.name).toBe('calculateTotal')
      expect(symbol.type).toBe('function')
      expect(symbol.filePath).toBe('src/math.ts')
      expect(symbol.line).toBe(42)
      expect(symbol.column).toBe(10)
      expect(symbol.visibility).toBe('public')
      expect(symbol.description).toBe('计算总和')
      expect(symbol.signature).toBe('(a: number, b: number): number')

      // 验证可放入 symbols 数组
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)
      const updatedBundle: RepoBrainBundle = {
        ...bundle,
        symbols: [...bundle.symbols, symbol]
      }

      expect(updatedBundle.symbols.length).toBe(1)
      expect(updatedBundle.symbols[0]).toBe(symbol)

      console.log('创建的 SymbolDefinition:', symbol)
    })

    it('createDependencyRelation() 应该创建完整的 DependencyRelation', () => {
      const dependency = createDependencyRelation({
        sourcePath: 'src/app.ts',
        targetPath: 'src/utils.ts',
        type: 'import',
        strength: 75,
        isCyclic: false,
        description: '导入工具函数'
      })

      // 验证必需字段
      expect(dependency.sourcePath).toBe('src/app.ts')
      expect(dependency.targetPath).toBe('src/utils.ts')
      expect(dependency.type).toBe('import')
      expect(dependency.strength).toBe(75)
      expect(dependency.isCyclic).toBe(false)
      expect(dependency.description).toBe('导入工具函数')

      // 验证可放入 dependencies 数组
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)
      const updatedBundle: RepoBrainBundle = {
        ...bundle,
        dependencies: [...bundle.dependencies, dependency]
      }

      expect(updatedBundle.dependencies.length).toBe(1)
      expect(updatedBundle.dependencies[0]).toBe(dependency)

      console.log('创建的 DependencyRelation:', dependency)
    })

    it('createHotspotArea() 应该创建完整的 HotspotArea', () => {
      const hotspot = createHotspotArea({
        id: 'hotspot-001',
        type: 'complex',
        filePaths: ['src/core.ts', 'src/utils.ts'],
        description: '核心业务逻辑复杂区域',
        severity: 8,
        confidence: 85,
        suggestions: ['考虑拆分模块', '添加单元测试']
      })

      // 验证必需字段
      expect(hotspot.id).toBe('hotspot-001')
      expect(hotspot.type).toBe('complex')
      expect(hotspot.filePaths).toEqual(['src/core.ts', 'src/utils.ts'])
      expect(hotspot.description).toBe('核心业务逻辑复杂区域')
      expect(hotspot.severity).toBe(8)
      expect(hotspot.confidence).toBe(85)
      expect(hotspot.suggestions).toEqual(['考虑拆分模块', '添加单元测试'])

      // 验证可放入 hotspots 数组
      const config: RepoBrainInput = { repoRoot: '/test' }
      const bundle = createRepoBrainBundle(config)
      const updatedBundle: RepoBrainBundle = {
        ...bundle,
        hotspots: [...bundle.hotspots, hotspot]
      }

      expect(updatedBundle.hotspots.length).toBe(1)
      expect(updatedBundle.hotspots[0]).toBe(hotspot)

      console.log('创建的 HotspotArea:', hotspot)
    })
  })

  describe('5. config / repoRoot 透传正确', () => {
    it('传入的 RepoBrainInput / config 被正确保留', () => {
      const config: RepoBrainInput = {
        repoRoot: '/custom/path',
        includeHidden: true,
        excludePatterns: ['dist', 'build'],
        includeExtensions: ['.ts', '.tsx'],
        maxFileSize: 500 * 1024, // 500KB
        analyzeSymbols: true,
        analyzeDependencies: true,
        detectHotspots: true,
        depthLimit: 5
      }

      const bundle = createRepoBrainBundle(config)

      // 验证 config 被正确保留
      expect(bundle.config.repoRoot).toBe('/custom/path')
      expect(bundle.config.includeHidden).toBe(true)
      expect(bundle.config.excludePatterns).toEqual(['dist', 'build'])
      expect(bundle.config.includeExtensions).toEqual(['.ts', '.tsx'])
      expect(bundle.config.maxFileSize).toBe(500 * 1024)
      expect(bundle.config.analyzeSymbols).toBe(true)
      expect(bundle.config.analyzeDependencies).toBe(true)
      expect(bundle.config.detectHotspots).toBe(true)
      expect(bundle.config.depthLimit).toBe(5)

      console.log('Config 透传验证:', {
        inputConfig: config,
        bundleConfig: bundle.config
      })
    })

    it('repoRoot 正确进入 bundle', () => {
      const testRepoRoot = '/some/very/specific/path'
      const config: RepoBrainInput = { repoRoot: testRepoRoot }
      const bundle = createRepoBrainBundle(config)

      expect(bundle.repoRoot).toBe(testRepoRoot)
      expect(bundle.config.repoRoot).toBe(testRepoRoot)

      // 验证 repoRoot 在多个位置一致
      expect(bundle.repoRoot).toBe(bundle.config.repoRoot)
    })

    it('默认配置值被正确设置', () => {
      const minimalConfig: RepoBrainInput = { repoRoot: '/minimal' }
      const bundle = createRepoBrainBundle(minimalConfig)

      // 验证默认值
      expect(bundle.config.analyzeSymbols).toBe(false)
      expect(bundle.config.analyzeDependencies).toBe(false)
      expect(bundle.config.detectHotspots).toBe(false)

      console.log('默认配置验证:', bundle.config)
    })
  })
})
