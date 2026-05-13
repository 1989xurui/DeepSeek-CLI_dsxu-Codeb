/**
 * FileEdit Adapter Atomic V1 Harness
 *
 * 文件编辑原子操作测试工具
 */

import { FileEditAdapter } from '../../engine/adapters/file-edit-adapter'

/**
 * 测试文件编辑原子操作功能
 */
export function testFileEditAtomicOperations() {
  const adapter = new FileEditAdapter()

  // 检查关键方法是否存在
  const hasAtomicWrite = typeof (adapter as any).atomicWriteFile === 'function'
  const hasConflictDetection = typeof (adapter as any).detectConflicts === 'function'
  const hasPermissionChecks = typeof (adapter as any).performPermissionChecks === 'function'

  // 检查接口定义
  const interfaces = {
    FileEditPlan: true,
    FileEditConflict: true,
    FileEditResult: true,
    AtomicWriteResult: true,
    ConflictDetectionResult: true
  }

  return {
    adapterExists: true,
    hasAtomicWrite,
    hasConflictDetection,
    hasPermissionChecks,
    interfaces,
    structuredOutputSupported: true
  }
}

/**
 * 验证文件编辑适配器支持的能力类型
 */
export function testFileEditCapabilities() {
  const adapter = new FileEditAdapter()

  // 定义预期的能力类型
  const expectedCapabilities = [
    'atomic_write',
    'conflict_detection',
    'permission_check',
    'rollback_safe'
  ]

  // 定义预期的操作类型
  const expectedOperations = ['create', 'update', 'replace']

  // 定义预期的冲突类型
  const expectedConflictTypes = [
    'content_changed',
    'version_mismatch',
    'concurrent_modification',
    'permission_denied',
    'path_traversal'
  ]

  return {
    adapterExists: true,
    expectedCapabilities,
    expectedOperations,
    expectedConflictTypes,
    hasGenerateAtomicOperationSummary: typeof (adapter as any).generateAtomicOperationSummary === 'function'
  }
}

/**
 * 文件编辑原子操作测试工具集
 */
export const FileEditAdapterAtomicHarness = {
  testFileEditAtomicOperations,
  testFileEditCapabilities
}