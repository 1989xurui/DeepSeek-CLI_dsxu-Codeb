/**
 * Graph Memory - 图记忆类型定义
 *
 * 吸收上游 LSP/MCP/Repo understanding 组织方式
 * 将 repo-brain 的扁平分析升级为图结构
 */

/**
 * 图节点类型
 */
export type GraphNodeType =
  | 'file'          // 文件
  | 'directory'     // 目录
  | 'function'      // 函数
  | 'class'         // 类
  | 'interface'     // 接口
  | 'type'          // 类型
  | 'variable'      // 变量
  | 'constant'      // 常量
  | 'enum'          // 枚举
  | 'module'        // 模块
  | 'package'       // 包
  | 'hotspot'       // 热点区域
  | 'task'          // 任务
  | 'session'       // 会话
  | 'memory'        // 记忆

/**
 * 图边类型
 */
export type GraphEdgeType =
  | 'contains'      // 包含关系（目录包含文件）
  | 'imports'       // 导入关系
  | 'requires'      // 依赖关系
  | 'references'    // 引用关系
  | 'extends'       // 继承关系
  | 'implements'    // 实现关系
  | 'calls'         // 调用关系
  | 'depends_on'    // 依赖关系
  | 'related_to'    // 相关关系
  | 'belongs_to'    // 属于关系
  | 'triggers'      // 触发关系
  | 'affects'       // 影响关系
  | 'similar_to'    // 相似关系

/**
 * 图节点属性
 */
export interface GraphNodeProperties {
  [key: string]: any
  // 文件相关属性
  path?: string
  extension?: string
  size?: number
  lastModified?: number
  // 符号相关属性
  line?: number
  column?: number
  visibility?: string
  signature?: string
  description?: string
  // 通用属性
  importance?: number
  complexity?: number
  changeFrequency?: number
  bugProneness?: number
  // 会话/任务相关
  sessionId?: string
  taskId?: string
  memoryId?: string
}

/**
 * 图节点
 */
export interface GraphNode {
  /** 节点唯一标识 */
  id: string
  /** 节点类型 */
  type: GraphNodeType
  /** 节点标签（可读名称） */
  label: string
  /** 节点属性 */
  properties: GraphNodeProperties
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}

/**
 * 图边属性
 */
export interface GraphEdgeProperties {
  [key: string]: any
  weight?: number // DSXU comment sanitized.
  strength?: number // DSXU comment sanitized.
  confidence?: number // DSXU comment sanitized.
  description?: string // DSXU comment sanitized.
  isCyclic?: boolean // DSXU comment sanitized.
  lastObserved?: number // DSXU comment sanitized.
  observationCount?: number // DSXU comment sanitized.
}

/**
 * 图边
 */
export interface GraphEdge {
  /** 边唯一标识 */
  id: string
  /** 源节点ID */
  sourceId: string
  /** 目标节点ID */
  targetId: string
  /** 边类型 */
  type: GraphEdgeType
  /** 边属性 */
  properties: GraphEdgeProperties
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}

/**
 * 图记忆元数据
 */
export interface GraphMemoryMetadata {
  /** 图版本 */
  version: string
  /** 创建时间戳 */
  createdAt: number
  /** 最后更新时间戳 */
  updatedAt: number
  /** 节点数量 */
  nodeCount: number
  /** 边数量 */
  edgeCount: number
  /** 数据来源 */
  sources: string[]
  /** 图覆盖范围描述 */
  coverage: string
  /** 统计信息 */
  statistics: {
    byNodeType: Record<GraphNodeType, number>
    byEdgeType: Record<GraphEdgeType, number>
    avgNodeDegree: number
    maxNodeDegree: number
    connectedComponents: number
  }
}

/**
 * 图记忆
 */
export interface GraphMemory {
  /** 图记忆ID */
  id: string
  /** 关联的会话ID */
  sessionId: string
  /** 关联的任务ID（可选） */
  taskId?: string
  /** 节点集合 */
  nodes: Map<string, GraphNode>
  /** 边集合 */
  edges: Map<string, GraphEdge>
  /** 元数据 */
  metadata: GraphMemoryMetadata
}

/**
 * 图构建配置
 */
export interface GraphBuildConfig {
  /** 是否包含文件节点 */
  includeFiles: boolean
  /** 是否包含目录节点 */
  includeDirectories: boolean
  /** 是否包含符号节点 */
  includeSymbols: boolean
  /** 是否包含热点节点 */
  includeHotspots: boolean
  /** 是否包含会话/任务节点 */
  includeSessionTasks: boolean
  /** 最大节点数量 */
  maxNodes?: number
  /** 最大边数量 */
  maxEdges?: number
  /** 最小关系权重阈值 */
  minWeightThreshold?: number
  /** 数据源列表 */
  sources: ('repo-brain' | 'lsp' | 'mcp' | 'memory' | 'session')[]
}

/**
 * 图更新选项
 */
export interface GraphUpdateOptions {
  /** 是否增量更新 */
  incremental: boolean
  /** 是否保留旧节点 */
  preserveOldNodes: boolean
  /** 是否保留旧边 */
  preserveOldEdges: boolean
  /** 最大更新节点数量 */
  maxUpdateNodes?: number
  /** 最大更新边数量 */
  maxUpdateEdges?: number
}
