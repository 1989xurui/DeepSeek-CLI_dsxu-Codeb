/**
 * DeepSeek 上下文构建器 (Context Builder)
 *
 * Work Package G: 上下文包核心结构定义
 * 为query-loop提供结构化、可压缩的上下文信息
 */

import type { TokenBudget, RepoBrainBundle } from './types'

/** 仓库文件映射项 */
export interface RepoMapItem {
  /** 文件路径 */
  path: string
  /** 文件内容（可选，可延迟加载） */
  content?: string
  /** 文件大小（字节） */
  size: number
  /** 最后修改时间 */
  lastModified: number
  /** 文件类型 */
  type: 'file' | 'directory'
  /** 是否被选中（在selectedFiles中） */
  selected?: boolean
}

/** 符号信息（类、函数、变量等） */
export interface SymbolInfo {
  /** 符号名称 */
  name: string
  /** 符号类型：class, function, variable, interface, type, enum, etc. */
  type: string
  /** 定义位置（文件路径:行号） */
  location: string
  /** 作用域 */
  scope?: string
  /** 文档注释 */
  documentation?: string
  /** 签名/类型信息 */
  signature?: string
}

/** 依赖项信息 */
export interface DependencyInfo {
  /** 依赖名称 */
  name: string
  /** 依赖版本 */
  version: string
  /** 依赖类型：production, development, peer, optional */
  type: 'production' | 'development' | 'peer' | 'optional'
  /** 是否在package.json中 */
  inPackageJson: boolean
  /** 是否已安装 */
  installed: boolean
}

/** 令牌预算配置 */
export interface ContextTokenBudget {
  /** 输入令牌预算 */
  inputBudget: number
  /** 保留输出令牌 */
  reservedOutput: number
  /** 总限制（输入+输出） */
  totalLimit: number
  /** 已使用输入令牌 */
  usedInput?: number
  /** 已使用输出令牌 */
  usedOutput?: number
}

/** 上下文包 - 核心结构定义 */
export interface ContextBundle {
  /** 任务ID */
  taskId: string
  /** 用户查询/任务描述 */
  query: string
  /** 仓库文件映射 */
  repoMap: RepoMapItem[]
  /** 符号信息 */
  symbols: SymbolInfo[]
  /** 依赖项信息 */
  dependencies: DependencyInfo[]
  /** 令牌预算 */
  tokenBudget: ContextTokenBudget
  /** 选中的文件列表（路径数组） */
  selectedFiles: string[]
  /** 备注/提示信息 */
  notes: string[]
  /** 生成时间戳 */
  generatedAt: number
  /** 上下文版本 */
  version: string
  /** 9A-B: Repo Brain 分析结果 */
  repoBrain?: RepoBrainBundle
}

/** 创建最小上下文包 */
export function createContextBundle(
  taskId: string,
  query: string,
  tokenBudget: Partial<ContextTokenBudget> = {},
  /** 9A-B: Repo Brain 分析结果 */
  repoBrain?: RepoBrainBundle
): ContextBundle {
  const now = Date.now()

  // 默认令牌预算
  const defaultTokenBudget: ContextTokenBudget = {
    inputBudget: 8000,
    reservedOutput: 2000,
    totalLimit: 10000,
    usedInput: 0,
    usedOutput: 0
  }

  return {
    taskId,
    query,
    repoMap: [],
    symbols: [],
    dependencies: [],
    tokenBudget: { ...defaultTokenBudget, ...tokenBudget },
    selectedFiles: [],
    notes: [],
    generatedAt: now,
    version: '1.0.0',
    // 9A-B: Repo Brain 分析结果
    repoBrain
  }
}

/** 更新上下文包令牌使用情况 */
export function updateTokenUsage(
  bundle: ContextBundle,
  inputTokens: number,
  outputTokens: number
): ContextBundle {
  return {
    ...bundle,
    tokenBudget: {
      ...bundle.tokenBudget,
      usedInput: (bundle.tokenBudget.usedInput || 0) + inputTokens,
      usedOutput: (bundle.tokenBudget.usedOutput || 0) + outputTokens
    }
  }
}

/** 检查令牌预算是否充足 */
export function hasSufficientTokenBudget(bundle: ContextBundle): boolean {
  const { inputBudget, reservedOutput, totalLimit, usedInput = 0, usedOutput = 0 } = bundle.tokenBudget

  // 检查输入预算
  if (usedInput > inputBudget) {
    return false
  }

  // 检查输出预留
  if (usedOutput > reservedOutput) {
    return false
  }

  // 检查总限制
  if (usedInput + usedOutput > totalLimit) {
    return false
  }

  return true
}

/** 获取剩余令牌预算 */
export function getRemainingTokenBudget(bundle: ContextBundle): {
  remainingInput: number
  remainingOutput: number
  remainingTotal: number
} {
  const { inputBudget, reservedOutput, totalLimit, usedInput = 0, usedOutput = 0 } = bundle.tokenBudget

  return {
    remainingInput: Math.max(0, inputBudget - usedInput),
    remainingOutput: Math.max(0, reservedOutput - usedOutput),
    remainingTotal: Math.max(0, totalLimit - (usedInput + usedOutput))
  }
}

/** 添加文件到仓库映射 */
export function addFileToRepoMap(
  bundle: ContextBundle,
  filePath: string,
  content?: string,
  size: number = 0
): ContextBundle {
  const newRepoMap = [...bundle.repoMap]

  // 检查是否已存在
  const existingIndex = newRepoMap.findIndex(item => item.path === filePath)
  if (existingIndex >= 0) {
    // 更新现有项
    newRepoMap[existingIndex] = {
      ...newRepoMap[existingIndex],
      content,
      size: content ? content.length : size,
      lastModified: Date.now()
    }
  } else {
    // 添加新项
    newRepoMap.push({
      path: filePath,
      content,
      size: content ? content.length : size,
      lastModified: Date.now(),
      type: 'file',
      selected: false
    })
  }

  return {
    ...bundle,
    repoMap: newRepoMap
  }
}

/** 添加符号信息 */
export function addSymbol(
  bundle: ContextBundle,
  symbol: Omit<SymbolInfo, 'location'> & { location?: string }
): ContextBundle {
  const fullSymbol: SymbolInfo = {
    location: 'unknown',
    ...symbol
  }

  return {
    ...bundle,
    symbols: [...bundle.symbols, fullSymbol]
  }
}

/** 添加依赖项信息 */
export function addDependency(
  bundle: ContextBundle,
  dependency: Omit<DependencyInfo, 'inPackageJson' | 'installed'> & {
    inPackageJson?: boolean
    installed?: boolean
  }
): ContextBundle {
  const fullDependency: DependencyInfo = {
    inPackageJson: true,
    installed: true,
    ...dependency
  }

  return {
    ...bundle,
    dependencies: [...bundle.dependencies, fullDependency]
  }
}

/** 添加备注 */
export function addNote(bundle: ContextBundle, note: string): ContextBundle {
  return {
    ...bundle,
    notes: [...bundle.notes, note]
  }
}

/** 选择文件 */
export function selectFile(bundle: ContextBundle, filePath: string): ContextBundle {
  // 添加到selectedFiles（如果不存在）
  const newSelectedFiles = bundle.selectedFiles.includes(filePath)
    ? bundle.selectedFiles
    : [...bundle.selectedFiles, filePath]

  // 更新repoMap中的selected标志
  const newRepoMap = bundle.repoMap.map(item =>
    item.path === filePath ? { ...item, selected: true } : item
  )

  return {
    ...bundle,
    selectedFiles: newSelectedFiles,
    repoMap: newRepoMap
  }
}

/** 获取选中的文件内容 */
export function getSelectedFilesContent(bundle: ContextBundle): Array<{
  path: string
  content: string
  size: number
}> {
  return bundle.repoMap
    .filter(item => item.selected && item.content !== undefined)
    .map(item => ({
      path: item.path,
      content: item.content!,
      size: item.size
    }))
}

/** 序列化上下文包为JSON（用于存储或传输） */
export function serializeContextBundle(bundle: ContextBundle): string {
  return JSON.stringify(bundle, null, 2)
}

/** 从JSON反序列化上下文包 */
export function deserializeContextBundle(json: string): ContextBundle {
  const parsed = JSON.parse(json)
  // 确保必要的字段存在
  return {
    taskId: parsed.taskId || '',
    query: parsed.query || '',
    repoMap: parsed.repoMap || [],
    symbols: parsed.symbols || [],
    dependencies: parsed.dependencies || [],
    tokenBudget: parsed.tokenBudget || {
      inputBudget: 8000,
      reservedOutput: 2000,
      totalLimit: 10000,
      usedInput: 0,
      usedOutput: 0
    },
    selectedFiles: parsed.selectedFiles || [],
    notes: parsed.notes || [],
    generatedAt: parsed.generatedAt || Date.now(),
    version: parsed.version || '1.0.0',
    // 9A-B: Repo Brain 分析结果
    repoBrain: parsed.repoBrain
  }
}
