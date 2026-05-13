/**
 * DSXU Repo Brain - 仓库大脑
 *
 * 分析代码仓库结构，提供智能索引和导航
 * 9A-B: 核心结构定义
 */

/**
 * 仓库地图节点 - 表示仓库中的文件或目录
 */
export interface RepoMapNode {
  /** 节点路径（相对于仓库根目录） */
  path: string
  /** 节点类型：file | directory */
  type: 'file' | 'directory'
  /** 文件扩展名（仅文件类型） */
  extension?: string
  /** 文件大小（字节，仅文件类型） */
  size?: number
  /** 最后修改时间戳 */
  lastModified?: number
  /** 是否被选中用于分析 */
  selected?: boolean
  /** 节点重要性评分（0-100） */
  importanceScore?: number
}

/**
 * 符号定义 - 代码中的标识符
 */
export interface SymbolDefinition {
  /** 符号名称 */
  name: string
  /** 符号类型：function | class | interface | type | variable | constant | enum */
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum'
  /** 符号所在文件路径 */
  filePath: string
  /** 符号位置（行号） */
  line: number
  /** 符号位置（列号） */
  column?: number
  /** 符号可见性：public | private | protected | internal */
  visibility?: 'public' | 'private' | 'protected' | 'internal'
  /** 符号描述（从注释提取） */
  description?: string
  /** 符号签名（函数签名、类型定义等） */
  signature?: string
}

/**
 * 依赖关系 - 文件或符号之间的引用关系
 */
export interface DependencyRelation {
  /** 源文件路径 */
  sourcePath: string
  /** 目标文件路径 */
  targetPath: string
  /** 依赖类型：import | require | reference | extend | implement | call */
  type: 'import' | 'require' | 'reference' | 'extend' | 'implement' | 'call'
  /** 依赖强度（0-100） */
  strength?: number
  /** 是否循环依赖 */
  isCyclic?: boolean
  /** 依赖描述 */
  description?: string
}

/**
 * 热点区域 - 代码中的关键或复杂区域
 */
export interface HotspotArea {
  /** 热点ID */
  id: string
  /** 热点类型：complex | critical | frequent-change | bug-prone | performance */
  type: 'complex' | 'critical' | 'frequent-change' | 'bug-prone' | 'performance'
  /** 相关文件路径列表 */
  filePaths: string[]
  /** 热点描述 */
  description: string
  /** 热点严重程度（1-10） */
  severity: number
  /** 热点置信度（0-100） */
  confidence?: number
  /** 建议操作 */
  suggestions?: string[]
}

/**
 * 仓库大脑输入配置
 */
export interface RepoBrainInput {
  /** 仓库根目录路径 */
  repoRoot: string
  /** 是否包含隐藏文件 */
  includeHidden?: boolean
  /** 要排除的文件模式 */
  excludePatterns?: string[]
  /** 要包含的文件扩展名 */
  includeExtensions?: string[]
  /** 最大文件大小（字节） */
  maxFileSize?: number
  /** 是否分析符号 */
  analyzeSymbols?: boolean
  /** 是否分析依赖 */
  analyzeDependencies?: boolean
  /** 是否检测热点 */
  detectHotspots?: boolean
  /** 分析深度限制 */
  depthLimit?: number
}

/**
 * 仓库大脑输出包
 */
export interface RepoBrainBundle {
  /** 仓库地图 - 文件系统结构 */
  repoMap: RepoMapNode[]
  /** 符号定义 - 代码中的标识符 */
  symbols: SymbolDefinition[]
  /** 依赖关系 - 文件/符号之间的引用 */
  dependencies: DependencyRelation[]
  /** 热点区域 - 关键或复杂代码区域 */
  hotspots: HotspotArea[]
  /** 选中的文件列表（用于进一步分析） */
  selectedFiles: string[]
  /** 入口点文件列表 */
  entryPoints: string[]
  /** 分析备注 */
  notes: string[]
  /** 生成时间戳 */
  generatedAt: number
  /** 仓库根目录 */
  repoRoot: string
  /** 分析配置 */
  config: RepoBrainInput
}

/**
 * 创建最小仓库大脑包
 *
 * 9A-B: 核心结构定义，执行主线仓库结构分析
 *
 * @param config 仓库大脑输入配置
 * @returns 最小仓库大脑包
 */
export function createRepoBrainBundle(config: RepoBrainInput): RepoBrainBundle {
  const now = Date.now()

  // 创建最小占位结构
  const bundle: RepoBrainBundle = {
    repoMap: [],
    symbols: [],
    dependencies: [],
    hotspots: [],
    selectedFiles: [],
    entryPoints: [],
    notes: ['9A-B: 核心结构定义 - 已进入主线仓库结构分析'],
    generatedAt: now,
    repoRoot: config.repoRoot,
    config: {
      ...config,
      analyzeSymbols: config.analyzeSymbols ?? false,
      analyzeDependencies: config.analyzeDependencies ?? false,
      detectHotspots: config.detectHotspots ?? false
    }
  }

  return bundle
}

/**
 * 创建仓库地图节点
 */
export function createRepoMapNode(params: {
  path: string
  type: 'file' | 'directory'
  extension?: string
  size?: number
  lastModified?: number
  selected?: boolean
  importanceScore?: number
}): RepoMapNode {
  return {
    path: params.path,
    type: params.type,
    extension: params.extension,
    size: params.size,
    lastModified: params.lastModified,
    selected: params.selected ?? false,
    importanceScore: params.importanceScore ?? 50
  }
}

/**
 * 创建符号定义
 */
export function createSymbolDefinition(params: {
  name: string
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum'
  filePath: string
  line: number
  column?: number
  visibility?: 'public' | 'private' | 'protected' | 'internal'
  description?: string
  signature?: string
}): SymbolDefinition {
  return {
    name: params.name,
    type: params.type,
    filePath: params.filePath,
    line: params.line,
    column: params.column,
    visibility: params.visibility ?? 'public',
    description: params.description,
    signature: params.signature
  }
}

/**
 * 创建依赖关系
 */
export function createDependencyRelation(params: {
  sourcePath: string
  targetPath: string
  type: 'import' | 'require' | 'reference' | 'extend' | 'implement' | 'call'
  strength?: number
  isCyclic?: boolean
  description?: string
}): DependencyRelation {
  return {
    sourcePath: params.sourcePath,
    targetPath: params.targetPath,
    type: params.type,
    strength: params.strength ?? 50,
    isCyclic: params.isCyclic ?? false,
    description: params.description
  }
}

/**
 * 创建热点区域
 */
export function createHotspotArea(params: {
  id: string
  type: 'complex' | 'critical' | 'frequent-change' | 'bug-prone' | 'performance'
  filePaths: string[]
  description: string
  severity: number
  confidence?: number
  suggestions?: string[]
}): HotspotArea {
  return {
    id: params.id,
    type: params.type,
    filePaths: params.filePaths,
    description: params.description,
    severity: params.severity,
    confidence: params.confidence ?? 70,
    suggestions: params.suggestions ?? []
  }
}
