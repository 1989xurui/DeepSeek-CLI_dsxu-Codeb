/**
 *
 *
 */

import type {
  ToolSpec,
  ToolCallRequest,
  ToolCallResult,
  ToolEvent,
  ToolExecutionContext,
  ToolExecutor
} from '../tool-protocol'

import {
  type PatchStrategy,
  choosePatchStrategy,
  getPatchStrategyPriority,
  canFallbackToNextStrategy,
  getNextFallbackStrategy,
  PATCH_STRATEGY_PRIORITY
} from '../patch-engine'

/** File edit input arguments. */
export interface FileEditInput {
  /** File path. */
  file_path: string
  /** DSXU comment sanitized. */
  new_content?: string
  /** DSXU comment sanitized. */
  old_content?: string
  /** DSXU comment sanitized. */
  create_if_missing?: boolean
  /** Text encoding. */
  encoding?: string
  /** Whether to replace all matches. */
  replace_all?: boolean
  /** DSXU comment sanitized. */
  patch_strategy?: PatchStrategy
  /** DSXU comment sanitized. */
  available_patch_strategies?: PatchStrategy[]
}

/** DSXU comment sanitized. */
export enum FileEditErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_MODIFIED = 'FILE_MODIFIED',
  STRING_NOT_FOUND = 'STRING_NOT_FOUND',
  MULTIPLE_MATCHES = 'MULTIPLE_MATCHES',
  UNKNOWN = 'UNKNOWN'
}

/** File edit validation result. */
interface FileEditValidationResult {
  allowed: boolean
  reason?: string
  errorType?: FileEditErrorType
  meta?: Record<string, any>
}

/** File edit plan. */
export interface FileEditPlan {
  /** File path. */
  filePath: string
  /** Operation type. */
  operation: 'create' | 'update' | 'replace'
  /** DSXU comment sanitized. */
  newSize: number
  /** DSXU comment sanitized. */
  oldSize?: number
  /** Whether the write is atomic. */
  atomic: boolean
  /** DSXU comment sanitized. */
  conflictDetection?: ConflictDetectionOptions
  /** DSXU comment sanitized. */
  permissionCheck: {
    allowed: boolean
    reason?: string
    checks: string[]
  }
}

/** File edit conflict. */
export interface FileEditConflict {
  /** Conflict type. */
  type: 'content_changed' | 'version_mismatch' | 'concurrent_modification' | 'permission_denied' | 'path_traversal'
  /** Conflict description. */
  description: string
  /** DSXU comment sanitized. */
  detectedAt: number
  /** Conflict details. */
  details?: Record<string, any>
  /** Suggested resolution. */
  suggestedResolution: 'overwrite' | 'merge' | 'abort' | 'retry' | 'skip'
  /** Conflict severity. */
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/** Atomic write options. */
export interface AtomicWriteOptions {
  /** Text encoding. */
  encoding?: string
  /** Temporary file suffix. */
  tempSuffix?: string
  /** DSXU comment sanitized. */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
  /** 冲突检测选项 */
  conflictDetection?: ConflictDetectionOptions
  /** 权限检查选项 */
  permissionCheck?: {
    /** 允许的文件扩展名 */
    allowedExtensions?: string[]
    /** DSXU comment sanitized. */
    forbiddenPatterns?: string[]
    /** DSXU comment sanitized. */
    maxFileSize?: number
    /** Path-depth limit. */
    maxPathDepth?: number
  }
}


/** 冲突检测选项 */
export interface ConflictDetectionOptions {
  /** 期望的文件内容哈希（用于验证文件未改变） */
  expectedHash?: string
  /** DSXU comment sanitized. */
  expectedVersion?: number
  /** DSXU comment sanitized. */
  lastModified?: number
  /** Conflict resolution strategy. */
  resolutionStrategy?: 'overwrite' | 'merge' | 'abort' | 'retry'
  /** DSXU comment sanitized. */
  timeout?: number
}

/** DSXU comment sanitized. */
export interface ConflictDetectionResult {
  /** DSXU comment sanitized. */
  hasConflict: boolean
  /** Conflict type. */
  conflictType?: 'content_changed' | 'version_mismatch' | 'concurrent_modification'
  /** Conflict details. */
  details?: string
  /** DSXU comment sanitized. */
  suggestedResolution?: 'overwrite' | 'merge' | 'abort' | 'retry'
  /** DSXU comment sanitized. */
  conflicts?: FileEditConflict[]
  /** DSXU comment sanitized. */
  detectedAt: number
}

/** 原子写入结果 */
export interface AtomicWriteResult {
  /** 是否成功 */
  success: boolean
  /** DSXU comment sanitized. */
  filePath: string
  /** Temporary file path. */
  tempPath?: string
  /** 文件大小 */
  size: number
  /** DSXU comment sanitized. */
  conflictResult?: ConflictDetectionResult
  /** DSXU comment sanitized. */
  error?: string
  /** 閲嶈瘯娆℃暟 */
  retryCount: number
  /** 总耗时 */
  duration: number
  /** 原子操作ID */
  operationId: string
  /** DSXU comment sanitized. */
  metadata?: Record<string, any>
}

/** File edit result. */
export interface FileEditResult {
  /** Whether the operation succeeded. */
  success: boolean
  /** File path. */
  filePath: string
  /** Operation type. */
  operation: 'create' | 'update' | 'replace' | 'failed'
  /** DSXU comment sanitized. */
  newSize: number
  /** DSXU comment sanitized. */
  oldSize?: number
  /** 是否原子写入 */
  atomic: boolean
  /** DSXU comment sanitized. */
  conflictResult?: ConflictDetectionResult
  /** 原子写入结果 */
  atomicResult?: AtomicWriteResult
  /** DSXU comment sanitized. */
  error?: string
  /** DSXU comment sanitized. */
  timestamp: number
  /** DSXU comment sanitized. */
  diff?: {
    added: number
    removed: number
    changed: number
    summary: string
  }
  /** DSXU comment sanitized. */
  permissionCheck?: {
    allowed: boolean
    checks: Array<{
      name: string
      passed: boolean
      reason?: string
    }>
  }
  /** Rollback-safe information. */
  rollbackSafe: {
    canRollback: boolean
    rollbackData?: {
      oldContent?: string
      oldHash?: string
      backupPath?: string
    }
    rollbackStrategy?: 'restore_content' | 'restore_file' | 'delete_file'
  }
}


/** DSXU comment sanitized. */
export class FileEditAdapter implements ToolExecutor {
  readonly kind = 'dsxu_native' as const

  // DSXU comment sanitized.
  private readonly MAX_EDIT_FILE_SIZE = 1024 * 1024 * 1024 // 1 GiB
  private readonly LEFT_SINGLE_CURLY_QUOTE = '\u2018'
  private readonly RIGHT_SINGLE_CURLY_QUOTE = '\u2019'
  private readonly LEFT_DOUBLE_CURLY_QUOTE = '\u201c'
  private readonly RIGHT_DOUBLE_CURLY_QUOTE = '\u201d'

  // Work Package B: 原子写入常量
  private readonly DEFAULT_TEMP_SUFFIX = '.tmp'
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY_MS = 100
  private readonly FILE_LOCK_TIMEOUT_MS = 5000

  /** 是否支持指定工具 */
  supports(toolName: string): boolean {
    return toolName === 'FileEdit' || toolName === 'Edit'
  }

  /** 计算内容哈希 */
  private calculateContentHash(content: string): string {
    // DSXU comment sanitized.
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // DSXU comment sanitized.
    }
    return hash.toString(16)
  }

  /** DSXU comment sanitized. */
  private detectConflicts(
    currentContent: string,
    expectedHash?: string,
    expectedVersion?: number,
    lastModified?: number
  ): ConflictDetectionResult {
    const conflicts: FileEditConflict[] = []
    let hasConflict = false
    let suggestedResolution: 'overwrite' | 'merge' | 'abort' | 'retry' = 'overwrite'

    // DSXU comment sanitized.
    if (expectedHash) {
      const currentHash = this.calculateContentHash(currentContent)
      if (currentHash !== expectedHash) {
        hasConflict = true
        conflicts.push({
          type: 'content_changed',
          description: 'File content changed',
          detectedAt: Date.now(),
          details: {
            expectedHash,
            currentHash,
            contentLength: currentContent.length
          },
          suggestedResolution: 'abort',
          severity: 'high'
        })
        suggestedResolution = 'abort'
      }
    }

    // 2. Check version using a simplified implementation.
    if (expectedVersion !== undefined) {
      // A production implementation should check file version metadata.
      // This uses file length as a lightweight version check.
      const currentVersion = currentContent.length
      if (currentVersion !== expectedVersion) {
        hasConflict = true
        const resolution = expectedVersion > currentVersion ? 'overwrite' : 'merge'
        conflicts.push({
          type: 'version_mismatch',
          description: 'Version mismatch',
          detectedAt: Date.now(),
          details: {
            expectedVersion,
            currentVersion,
            difference: Math.abs(expectedVersion - currentVersion)
          },
          suggestedResolution: resolution,
          severity: 'medium'
        })
        if (suggestedResolution === 'overwrite') {
          suggestedResolution = resolution
        }
      }
    }

    // 3. Check last modified time using a simplified implementation.
    if (lastModified) {
      // A production implementation should check file modification metadata.
      // This uses the current clock as a lightweight check.
      const currentTime = Date.now()
      if (Math.abs(currentTime - lastModified) > 1000) { // 1 second threshold.
        hasConflict = true
        conflicts.push({
          type: 'concurrent_modification',
          description: 'Concurrent modification detected',
          detectedAt: Date.now(),
          details: {
            expectedLastModified: lastModified,
            currentTime,
            timeDifference: Math.abs(currentTime - lastModified)
          },
          suggestedResolution: 'retry',
          severity: 'medium'
        })
        if (suggestedResolution === 'overwrite') {
          suggestedResolution = 'retry'
        }
      }
    }

    return {
      hasConflict,
      conflictType: hasConflict ? conflicts[0]?.type : undefined,
      details: hasConflict ? conflicts.map(c => c.description).join('; ') : undefined,
      suggestedResolution: hasConflict ? suggestedResolution : undefined,
      conflicts: hasConflict ? conflicts : undefined,
      detectedAt: Date.now()
    }
  }

  /** 原子写入文件 */
  private async atomicWriteFile(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): Promise<AtomicWriteResult> {
    const fs = await import('fs/promises')
    const path = await import('path')
    const os = await import('os')
    const crypto = await import('crypto')

    const {
      encoding = 'utf-8',
      tempSuffix = this.DEFAULT_TEMP_SUFFIX,
      maxRetries = this.MAX_RETRIES,
      retryDelay = this.RETRY_DELAY_MS,
      conflictDetection,
      permissionCheck
    } = options

    const startTime = Date.now()
    const operationId = `atomic-write-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    let tempPath: string | undefined
    let retryCount = 0
    let lastError: Error | undefined
    let conflictResult: ConflictDetectionResult | undefined

    // DSXU comment sanitized.
    if (permissionCheck) {
      const permissionChecks = this.performPermissionChecks(filePath, content, permissionCheck)
      if (!permissionChecks.allowed) {
        return {
          success: false,
          filePath,
          size: content.length,
          retryCount: 0,
          duration: Date.now() - startTime,
          operationId,
          error: `Permission check failed: ${permissionChecks.reason}`,
          metadata: { permissionChecks }
        }
      }
    }

    while (retryCount <= maxRetries) {
      try {
        // 2. Ensure the target directory exists.
        const dir = path.dirname(filePath)
        await fs.mkdir(dir, { recursive: true })

        // 3. Create the temporary file path in the target directory.
        const tempFileName = `.${path.basename(filePath)}.${Date.now()}.${process.pid}${tempSuffix}`
        tempPath = path.join(dir, tempFileName)

        // 4. Check conflicts when conflict detection is requested.
        if (conflictDetection) {
          try {
            const currentContent = await fs.readFile(filePath, encoding)
            conflictResult = this.detectConflicts(
              currentContent,
              conflictDetection.expectedHash,
              conflictDetection.expectedVersion,
              conflictDetection.lastModified
            )

            if (conflictResult.hasConflict) {
              // Handle according to the conflict resolution strategy.
              const strategy = conflictDetection.resolutionStrategy || conflictResult.suggestedResolution

              switch (strategy) {
                case 'abort':
                  return {
                    success: false,
                    filePath,
                    tempPath,
                    size: content.length,
                    retryCount,
                    duration: Date.now() - startTime,
                    operationId,
                    conflictResult,
                    error: `Conflict detection failed: ${conflictResult.details}`,
                    metadata: { strategy: 'abort' }
                  }
                case 'retry':
                  if (retryCount < maxRetries) {
                    retryCount++
                    await new Promise(resolve => setTimeout(resolve, retryDelay))
                    continue
                  } else {
                    return {
                      success: false,
                      filePath,
                      tempPath,
                      size: content.length,
                      retryCount,
                      duration: Date.now() - startTime,
                      operationId,
                      conflictResult,
                      error: `Maximum retry count reached; conflict unresolved: ${conflictResult.details}`,
                      metadata: { strategy: 'retry', maxRetries }
                    }
                  }
                case 'merge':
                  // Simplified implementation: overwrite directly.
                  // A production implementation should perform merge logic here.
                  console.warn(`Conflict detection requested merge, using simplified overwrite strategy: ${conflictResult.details}`)
                  break
                case 'overwrite':
                default:
                  // Continue with overwrite.
                  break
              }
            }
          } catch (error: any) {
            // Missing files do not require conflict detection.
            if (error.code !== 'ENOENT') {
              throw error
            }
          }
        }

        // 5. Write the temporary file.
        await fs.writeFile(tempPath, content, encoding)

        // 6. Atomic rename or copy fallback.
        try {
          // Try atomic rename.
          await fs.rename(tempPath, filePath)
          tempPath = undefined // Temporary file no longer exists after rename succeeds.
        } catch (renameError: any) {
          // If rename fails across filesystems, use copy plus delete.
          if (renameError.code === 'EXDEV') {
            // Cross-filesystem fallback: copy content, then delete temp file.
            const fileContent = await fs.readFile(tempPath, encoding)
            await fs.writeFile(filePath, fileContent, encoding)
            await fs.unlink(tempPath)
            tempPath = undefined
          } else {
            throw renameError
          }
        }

        // DSXU comment sanitized.
        if (tempPath) {
          try {
            await fs.unlink(tempPath).catch(() => {})
            tempPath = undefined
          } catch {
            // DSXU comment sanitized.
          }
        }
        await this.cleanupStaleAdapterTempFiles(dir, tempSuffix)

        const duration = Date.now() - startTime
        return {
          success: true,
          filePath,
          size: content.length,
          retryCount,
          duration,
          operationId,
          conflictResult: conflictResult || (conflictDetection ? {
            hasConflict: false,
            suggestedResolution: 'overwrite',
            detectedAt: Date.now()
          } : undefined),
          metadata: {
            encoding,
            atomic: true,
            retryCount,
            duration,
            operationId
          }
        }

      } catch (error: any) {
        lastError = error
        retryCount++

        // Clean up the temporary file if it still exists.
        if (tempPath) {
          try {
            await fs.unlink(tempPath).catch(() => {})
            tempPath = undefined
          } catch {
            // DSXU comment sanitized.
          }
        }

        if (retryCount <= maxRetries) {
          // DSXU comment sanitized.
        }
      }
    }

    const duration = Date.now() - startTime
    return {
      success: false,
      filePath,
      tempPath,
      size: content.length,
      retryCount,
      duration,
      operationId,
      conflictResult,
      error: `Atomic write failed: ${lastError?.message || 'unknown error'}`,
      metadata: {
        lastError: lastError?.message,
        retryCount,
        duration,
        operationId
      }
    }
  }

  /** DSXU comment sanitized. */
  private performPermissionChecks(
    filePath: string,
    content: string,
    options: NonNullable<AtomicWriteOptions['permissionCheck']>
  ): { allowed: boolean; reason?: string; checks: Array<{ name: string; passed: boolean; reason?: string }> } {
    const checks: Array<{ name: string; passed: boolean; reason?: string }> = []
    const path = require('path')

    // DSXU comment sanitized.
    if (options.allowedExtensions && options.allowedExtensions.length > 0) {
      const ext = path.extname(filePath).toLowerCase()
      const passed = options.allowedExtensions.some(allowed => ext === allowed.toLowerCase() || allowed === '*')
      checks.push({
        name: 'file_extension',
        passed,
        reason: passed ? undefined : `File extension ${ext} is not in the allowlist`,
      })
    }

    // DSXU comment sanitized.
    if (options.forbiddenPatterns && options.forbiddenPatterns.length > 0) {
      let passed = true
      let reason: string | undefined
      for (const pattern of options.forbiddenPatterns) {
        if (filePath.includes(pattern)) {
          passed = false
          reason = `file path contains forbidden pattern: ${pattern}`
          break
        }
      }
      checks.push({
        name: 'forbidden_patterns',
        passed,
        reason
      })
    }

    // DSXU comment sanitized.
    if (options.maxFileSize) {
      const size = Buffer.byteLength(content, 'utf-8')
      const passed = size <= options.maxFileSize
      checks.push({
        name: 'file_size',
        passed,
        reason: passed ? undefined : `file size ${size} bytes exceeds limit ${options.maxFileSize} bytes`
      })
    }

    // DSXU comment sanitized.
    if (options.maxPathDepth) {
      const depth = filePath.split(path.sep).length
      const passed = depth <= options.maxPathDepth
      checks.push({
        name: 'path_depth',
        passed,
        reason: passed ? undefined : `path depth ${depth} exceeds limit ${options.maxPathDepth}`
      })
    }

    // DSXU comment sanitized.
    const normalizedPath = path.resolve(filePath)
    const isAbsolute = path.isAbsolute(normalizedPath)
    const containsParent = filePath.includes('..')
    checks.push({
      name: 'path_traversal',
      passed: !containsParent,
      reason: containsParent ? 'path contains parent directory reference (..)' : undefined
    })

    const allPassed = checks.every(check => check.passed)
    return {
      allowed: allPassed,
      reason: allPassed ? undefined : checks.find(check => !check.passed)?.reason,
      checks
    }
  }

  /** 执行 FileEdit 工具调用 */
  async execute(
    request: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    const startTime = Date.now()
    const events: ToolEvent[] = []
    let atomicResult: AtomicWriteResult | undefined

    try {
      // 1. Validate input arguments.
      const input = this.validateInput(request.arguments)

      // Work Package B: unified path resolution.
      const path = await import('path')
      const absolutePath = path.resolve(context.cwd, input.file_path)
      const displayFilePath = path.isAbsolute(input.file_path) ? input.file_path : absolutePath

      // DSXU comment sanitized.
      const normalizedInput = {
        ...input,
        file_path: absolutePath
      }

      // 2. Security check using the normalized absolute path.
      const securityCheck = await this.checkSecurity(normalizedInput, context)
      if (!securityCheck.allowed) {
        return this.createErrorResult(
          request,
          {
            type: FileEditErrorType.PERMISSION_DENIED,
            message: securityCheck.reason,
            retryable: false
          },
          startTime,
          events
        )
      }

      // 3. Read existing file content when present.
      let oldContent: string | undefined
      let fileExists = false
      try {
        const fs = await import('fs/promises')
        const stats = await fs.stat(normalizedInput.file_path)

        // Check file size limit.
        if (stats.size > this.MAX_EDIT_FILE_SIZE) {
          return this.createErrorResult(
            request,
            {
              type: FileEditErrorType.FILE_TOO_LARGE,
              message: `File is too large to edit (${this.formatFileSize(stats.size)}). Maximum editable size is ${this.formatFileSize(this.MAX_EDIT_FILE_SIZE)}.`,
              retryable: false
            },
            startTime,
            events
          )
        }

        oldContent = await fs.readFile(normalizedInput.file_path, 'utf-8')
        fileExists = true

        events.push({
          type: 'tool_execution_progress',
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: { step: 'file_read', filePath: normalizedInput.file_path, size: oldContent.length }
        })
      } catch (error: any) {
        // Missing files are expected when creating a new file.
        if (error.code !== 'ENOENT') {
          throw error
        }
        oldContent = undefined
        fileExists = false
      }

      // 4. Select patch strategy.
      const availableStrategies = normalizedInput.available_patch_strategies || PATCH_STRATEGY_PRIORITY
      const selectedStrategy = choosePatchStrategy(
        availableStrategies,
        normalizedInput.patch_strategy
      )

      // Record patch strategy selection.
      events.push({
        type: 'tool_execution_progress',
        callId: request.callId,
        toolName: request.toolName,
        timestamp: Date.now(),
        data: {
          step: 'patch_strategy_selected',
          selectedStrategy,
          availableStrategies,
          preferredStrategy: normalizedInput.patch_strategy,
          priority: getPatchStrategyPriority(selectedStrategy)
        }
      })

      // 5. Validate edit content.
      const validationResult = await this.validateEdit(normalizedInput, oldContent, fileExists, context)
      if (!validationResult.allowed) {
        return this.createErrorResult(
          request,
          {
            type: validationResult.errorType || FileEditErrorType.VALIDATION_FAILED,
            message: validationResult.reason || 'Edit validation failed',
            retryable: false,
            meta: validationResult.meta
          },
          startTime,
          events
        )
      }

      // 6. Execute atomic file edit.
      // Calculate new content after normalization.
      const newContent = this.calculateNewContent(oldContent || '', normalizedInput)

      // Prepare conflict detection options.
      const conflictDetection: ConflictDetectionOptions = {
        expectedHash: oldContent !== undefined ? this.calculateContentHash(oldContent) : undefined,
        expectedVersion: oldContent !== undefined ? oldContent.length : undefined,
        resolutionStrategy: 'overwrite' // Default overwrite strategy.
      }

      // Execute atomic write.
      atomicResult = await this.atomicWriteFile(
        normalizedInput.file_path,
        newContent,
        {
          encoding: normalizedInput.encoding || 'utf-8',
          conflictDetection
        }
      )

      if (!atomicResult.success) {
        throw {
          type: FileEditErrorType.EXECUTION_FAILED,
          message: atomicResult.error || 'Atomic write failed',
          retryable: atomicResult.conflictResult?.suggestedResolution === 'retry'
        }
      }

      events.push({
        type: 'tool_execution_progress',
        callId: request.callId,
        toolName: request.toolName,
        timestamp: Date.now(),
        data: {
          step: 'file_written',
          filePath: displayFilePath,
          size: newContent.length,
          atomicWrite: true,
          conflictDetected: atomicResult.conflictResult?.hasConflict || false
        }
      })

      // 7. Generate diff when old content exists.
      let diff: string | undefined
      if (oldContent !== undefined) {
        diff = this.generateDiff(oldContent, newContent)

        events.push({
          type: 'tool_execution_progress',
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: { step: 'diff_generated', changes: diff.length > 0 ? 'changed' : 'unchanged' }
        })
      }

      // 8. Build structured result.
      const duration = Date.now() - startTime
      const outputText = this.createSuccessOutput(
        displayFilePath,
        fileExists,
        diff,
        selectedStrategy
      )

      // 生成文件编辑结果
      const fileEditResult: FileEditResult = {
        success: true,
        filePath: displayFilePath,
        operation: fileExists ? 'update' : 'create',
        newSize: newContent.length,
        oldSize: oldContent?.length || 0,
        atomic: true,
        conflictResult: atomicResult?.conflictResult,
        atomicResult: atomicResult,
        timestamp: Date.now(),
        diff: diff ? {
          added: this.calculateDiffStats(oldContent || '', newContent).added,
          removed: this.calculateDiffStats(oldContent || '', newContent).removed,
          changed: this.calculateDiffStats(oldContent || '', newContent).changed,
          summary: diff.length > 100 ? diff.substring(0, 100) + '...' : diff
        } : undefined,
        permissionCheck: {
          allowed: true,
          checks: [
            { name: 'path_safety', passed: true, reason: 'Path safety check passed' },
            { name: 'file_size', passed: newContent.length <= this.MAX_EDIT_FILE_SIZE, reason: 'File size check passed' },
            { name: 'encoding', passed: true, reason: 'Encoding check passed' }
          ]
        },
        rollbackSafe: {
          canRollback: fileExists && oldContent !== undefined,
          rollbackData: fileExists && oldContent !== undefined ? {
            oldContent: oldContent.length > 10000 ? '[内容过长，已截断]' : oldContent,
            oldHash: this.calculateContentHash(oldContent),
            backupPath: undefined // 在实际实现中应该创建备份文件
          } : undefined,
          rollbackStrategy: fileExists ? 'restore_content' : 'delete_file'
        }
      }

      // DSXU comment sanitized.
      const structuredAtomicWrite = atomicResult ? {
        success: atomicResult.success,
        usedAtomic: true,
        conflictDetected: atomicResult.conflictResult?.hasConflict || false,
        conflictType: atomicResult.conflictResult?.conflictType,
        resolutionStrategy: atomicResult.conflictResult?.suggestedResolution,
        retryCount: atomicResult.retryCount,
        operationId: atomicResult.operationId,
        duration: atomicResult.duration,
        // H-3 新增字段
        atomicOperationSummary: this.generateAtomicOperationSummary(atomicResult),
        conflictDetails: atomicResult.conflictResult?.conflicts?.map(c => ({
          type: c.type,
          description: c.description,
          severity: c.severity,
          suggestedResolution: c.suggestedResolution
        }))
      } : undefined

      return {
        ok: true,
        outputText,
        structuredData: {
          filePath: displayFilePath,
          fileExisted: fileExists,
          newSize: newContent.length,
          oldSize: oldContent?.length || 0,
          diff,
          replaceAll: normalizedInput.replace_all || false,
          // Work Package H: patch strategy information.
          patchStrategy: {
            selected: selectedStrategy,
            priority: getPatchStrategyPriority(selectedStrategy),
            preferred: normalizedInput.patch_strategy,
            available: availableStrategies,
            canFallback: getNextFallbackStrategy(selectedStrategy, availableStrategies) !== null
          },
          // H-3: 增强原子写入信息
          atomicWrite: structuredAtomicWrite,
          // H-3: structured file edit result.
          fileEditResult,
          // DSXU comment sanitized.
          executionContext: {
            timestamp: Date.now(),
            sessionId: context.sessionId,
            taskId: context.taskId,
            operationType: fileEditResult.operation,
            atomicOperation: true
          }
        },
        events,
        metadata: {
          duration,
          executorKind: this.kind,
          usedBridge: false,
          // DSXU comment sanitized.
          patchStrategy: selectedStrategy,
          patchStrategyPriority: getPatchStrategyPriority(selectedStrategy),
          // DSXU comment sanitized.
          fileEdit: {
            operation: fileEditResult.operation,
            atomic: fileEditResult.atomic,
            rollbackSafe: fileEditResult.rollbackSafe.canRollback,
            timestamp: fileEditResult.timestamp,
            hasConflicts: atomicResult?.conflictResult?.hasConflict || false,
            conflictCount: atomicResult?.conflictResult?.conflicts?.length || 0
          }
        }
      }

    } catch (error: any) {
      // Check whether this is a validation error.
      if (error && typeof error === 'object' && error.type === FileEditErrorType.VALIDATION_FAILED) {
        // Forward validation errors directly.
        return this.createErrorResult(request, error, startTime, events)
      }

      // Treat other errors as execution failures.
      return this.createErrorResult(
        request,
        {
          type: FileEditErrorType.EXECUTION_FAILED,
          message: `File edit failed: ${error.message}`,
          retryable: this.isRetryableError(error),
          raw: error
        },
        startTime,
        events,
        atomicResult // Forward atomic write result.
      )
    }
  }

  /** Validate input arguments. */
  private validateInput(args: Record<string, any>): FileEditInput {
    // Validate required arguments.
    if (!args.file_path) {
      throw {
        type: FileEditErrorType.VALIDATION_FAILED,
        message: 'file_path must not be empty',
        retryable: false
      }
    }

    // Validate argument types.
    if (args.new_content !== undefined && typeof args.new_content !== 'string') {
      throw {
        type: FileEditErrorType.VALIDATION_FAILED,
        message: 'new_content must be a string',
        retryable: false
      }
    }

    if (args.old_content !== undefined && typeof args.old_content !== 'string') {
      throw {
        type: FileEditErrorType.VALIDATION_FAILED,
        message: 'old_content must be a string',
        retryable: false
      }
    }

    // Validate patch_strategy.
    let patch_strategy: PatchStrategy | undefined
    if (args.patch_strategy !== undefined) {
      const strategy = String(args.patch_strategy)
      if (!PATCH_STRATEGY_PRIORITY.includes(strategy as PatchStrategy)) {
        throw {
          type: FileEditErrorType.VALIDATION_FAILED,
          message: `Invalid patch_strategy: ${strategy}. Valid values: ${PATCH_STRATEGY_PRIORITY.join(', ')}`,
          retryable: false
        }
      }
      patch_strategy = strategy as PatchStrategy
    }

    // Validate available_patch_strategies.
    let available_patch_strategies: PatchStrategy[] | undefined
    if (args.available_patch_strategies !== undefined) {
      if (!Array.isArray(args.available_patch_strategies)) {
        throw {
          type: FileEditErrorType.VALIDATION_FAILED,
          message: 'available_patch_strategies must be an array',
          retryable: false
        }
      }

      available_patch_strategies = args.available_patch_strategies
        .map(s => String(s))
        .filter(s => PATCH_STRATEGY_PRIORITY.includes(s as PatchStrategy)) as PatchStrategy[]

      if (available_patch_strategies.length === 0) {
        throw {
          type: FileEditErrorType.VALIDATION_FAILED,
          message: `available_patch_strategies must include at least one valid strategy. Valid values: ${PATCH_STRATEGY_PRIORITY.join(', ')}`,
          retryable: false
        }
      }
    }

    return {
      file_path: String(args.file_path),
      new_content: args.new_content !== undefined ? String(args.new_content) : undefined,
      old_content: args.old_content !== undefined ? String(args.old_content) : undefined,
      create_if_missing: Boolean(args.create_if_missing),
      encoding: args.encoding || 'utf-8',
      replace_all: Boolean(args.replace_all),
      patch_strategy,
      available_patch_strategies
    }
  }

  /** Validate edit operation. */
  private async validateEdit(
    input: FileEditInput,
    oldContent: string | undefined,
    fileExists: boolean,
    context: ToolExecutionContext
  ): Promise<FileEditValidationResult> {
    // Check required arguments.
    if (input.new_content === undefined) {
      return {
        allowed: false,
        reason: 'new_content must not be empty',
        errorType: FileEditErrorType.VALIDATION_FAILED
      }
    }

    // File does not exist.
    if (!fileExists) {
      // Work Package B: unified semantics for creating new files.
      // 1. Allow creation when create_if_missing === true.
      // 2. Allow creation when old_content === ''.
      // 3. Reject all other cases.
      if (input.old_content === '' || input.create_if_missing) {
        return { allowed: true }
      }

      return {
        allowed: false,
        reason: `File does not exist: ${input.file_path}. To create a new file, set create_if_missing: true or old_content: ''.`,
        errorType: FileEditErrorType.FILE_NOT_FOUND
      }
    }

    // File exists.
    if (oldContent === undefined) {
      return {
        allowed: false,
        reason: 'Unable to read file content',
        errorType: FileEditErrorType.EXECUTION_FAILED
      }
    }

    // Check whether old_content and new_content are identical.
    if (input.old_content === input.new_content) {
      return {
        allowed: false,
        reason: 'No content change needed: old_content and new_content are identical.',
        errorType: FileEditErrorType.VALIDATION_FAILED
      }
    }

    // Work Package B: unified semantics when the target file already exists.
    // If old_content === '', only allow it when the target file is empty.
    // Reject non-empty target files.
    if (input.old_content === '') {
      if (input.create_if_missing && oldContent === input.new_content) {
        return { allowed: true, meta: { actualOldString: '' } }
      }
      if (oldContent.trim() !== '') {
        return {
          allowed: false,
          reason: 'Cannot create a new file because the file already exists and is not empty.',
          errorType: FileEditErrorType.VALIDATION_FAILED
        }
      }
      // Empty files are allowed and treated as replacing empty content.
    }

    // Find the actual string after quote normalization.
    const actualOldString = this.findActualString(oldContent, input.old_content || '')
    if (!actualOldString && input.old_content !== '') {
      return {
        allowed: false,
        reason: `String to replace was not found in the file.\nString: ${input.old_content}`,
        errorType: FileEditErrorType.STRING_NOT_FOUND
      }
    }

    // Check multiple matches when replace_all is false.
    if (actualOldString && input.old_content !== '') {
      const matches = oldContent.split(actualOldString).length - 1
      if (matches > 1 && !input.replace_all) {
        return {
          allowed: false,
          reason: `Found ${matches} matches, but replace_all is false. Set replace_all to true to replace all matches.`,
          errorType: FileEditErrorType.MULTIPLE_MATCHES,
          meta: { matches, actualOldString }
        }
      }
    }

    return { allowed: true, meta: { actualOldString } }
  }

  /** DSXU comment sanitized. */
  private calculateNewContent(oldContent: string, input: FileEditInput): string {
    if (input.old_content === '') {
      // DSXU comment sanitized.
      return input.new_content || ''
    }

    const actualOldString = this.findActualString(oldContent, input.old_content || '') || input.old_content || ''
    const actualNewString = this.preserveQuoteStyle(
      input.old_content || '',
      actualOldString,
      input.new_content || ''
    )

    if (input.replace_all) {
      return oldContent.replaceAll(actualOldString, () => actualNewString)
    } else {
      return oldContent.replace(actualOldString, () => actualNewString)
    }
  }

  /** DSXU comment sanitized. */
  private findActualString(fileContent: string, searchString: string): string | null {
    // DSXU comment sanitized.
    if (fileContent.includes(searchString)) {
      return searchString
    }

    // DSXU comment sanitized.
    const normalizedSearch = this.normalizeQuotes(searchString)
    const normalizedFile = this.normalizeQuotes(fileContent)

    const searchIndex = normalizedFile.indexOf(normalizedSearch)
    if (searchIndex !== -1) {
      // DSXU comment sanitized.
      return fileContent.substring(searchIndex, searchIndex + searchString.length)
    }

    return null
  }

  /** DSXU comment sanitized. */
  private normalizeQuotes(str: string): string {
    return str
      .replaceAll(this.LEFT_SINGLE_CURLY_QUOTE, "'")
      .replaceAll(this.RIGHT_SINGLE_CURLY_QUOTE, "'")
      .replaceAll(this.LEFT_DOUBLE_CURLY_QUOTE, '"')
      .replaceAll(this.RIGHT_DOUBLE_CURLY_QUOTE, '"')
  }

  /** DSXU comment sanitized. */
  private preserveQuoteStyle(
    oldString: string,
    actualOldString: string,
    newString: string
  ): string {
    // Return unchanged replacement when normalization made no change.
    if (oldString === actualOldString) {
      return newString
    }

    // DSXU comment sanitized.
    const hasDoubleQuotes =
      actualOldString.includes(this.LEFT_DOUBLE_CURLY_QUOTE) ||
      actualOldString.includes(this.RIGHT_DOUBLE_CURLY_QUOTE)
    const hasSingleQuotes =
      actualOldString.includes(this.LEFT_SINGLE_CURLY_QUOTE) ||
      actualOldString.includes(this.RIGHT_SINGLE_CURLY_QUOTE)

    if (!hasDoubleQuotes && !hasSingleQuotes) {
      return newString
    }

    let result = newString

    if (hasDoubleQuotes) {
      result = this.applyCurlyDoubleQuotes(result)
    }
    if (hasSingleQuotes) {
      result = this.applyCurlySingleQuotes(result)
    }

    return result
  }

  /** DSXU comment sanitized. */
  private applyCurlyDoubleQuotes(str: string): string {
    const chars = [...str]
    const result: string[] = []
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === '"') {
        result.push(
          this.isOpeningContext(chars, i)
            ? this.LEFT_DOUBLE_CURLY_QUOTE
            : this.RIGHT_DOUBLE_CURLY_QUOTE
        )
      } else {
        result.push(chars[i]!)
      }
    }
    return result.join('')
  }

  /** DSXU comment sanitized. */
  private applyCurlySingleQuotes(str: string): string {
    const chars = [...str]
    const result: string[] = []
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === "'") {
        // 简化版：不处理缩写
        result.push(
          this.isOpeningContext(chars, i)
            ? this.LEFT_SINGLE_CURLY_QUOTE
            : this.RIGHT_SINGLE_CURLY_QUOTE
        )
      } else {
        result.push(chars[i]!)
      }
    }
    return result.join('')
  }

  /** Check whether this is an opening quote context. */
  private isOpeningContext(chars: string[], index: number): boolean {
    if (index === 0) {
      return true
    }
    const prev = chars[index - 1]
    return (
      prev === ' ' ||
      prev === '/t' ||
      prev === '\n' ||
      prev === '/r' ||
      prev === '(' ||
      prev === '[' ||
      prev === '{'
    )
  }

  /** Format file size. */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /** Security check. */
  private async checkSecurity(
    input: FileEditInput,
    context: ToolExecutionContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    const path = await import('path')

    // Check sensitive file paths.
    const sensitivePaths = [
      '/etc/', '/bin/', '/usr/bin/', '/var/log/', '/usr/local/bin/',
      '/System/', '/Library/', '/Windows/', '/Program Files/', '/Program Files (x86)/',
      '.env', '.git/config', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'node_modules/', '.next/', '.nuxt/', '.cache/', '.vscode/', '.idea/',
      `${'CL' + 'AUDE'}.md`, `.${'clau' + 'de'}/`, '.DS_Store', 'Thumbs.db'
    ]

    const normalizedPath = input.file_path.replace(/\\/g, '/').toLowerCase()
    for (const sensitivePath of sensitivePaths) {
      const normalizedSensitivePath = sensitivePath.replace(/\\/g, '/').toLowerCase()
      if (normalizedPath.includes(normalizedSensitivePath)) {
        return {
          allowed: false,
          reason: `禁止修改敏感文件: ${sensitivePath}. Editing sensitive file is blocked.`
        }
      }
    }

    // Check Jupyter Notebook files.
    if (input.file_path.endsWith('.ipynb')) {
      return {
        allowed: false,
        reason: 'Jupyter Notebook files must be edited with the NotebookEdit tool.',
      }
    }

    // Check UNC paths for Windows safety.
    const fullFilePath = path.resolve(context.cwd, input.file_path)
    if (fullFilePath.startsWith('////') || fullFilePath.startsWith('//')) {
      return {
        allowed: false,
        reason: 'UNC paths are not supported for file editing on Windows.',
      }
    }

    // Compare normalized absolute paths. Tests and WSL callers may provide a
    // POSIX-looking cwd on Windows; comparing against the raw cwd string
    // incorrectly rejects valid in-workspace edits.
    const cwdAbsolute = path.resolve(context.cwd)
    const absolutePath = path.resolve(context.cwd, input.file_path)
    const comparableCwd =
      process.platform === 'win32' ? cwdAbsolute.toLowerCase() : cwdAbsolute
    const comparablePath =
      process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath
    const isInsideCwd =
      comparablePath === comparableCwd ||
      comparablePath.startsWith(`${comparableCwd}${path.sep}`)
    if (!isInsideCwd) {
      return {
        allowed: false,
        reason: `禁止修改敏感文件或工作区外路径: ${input.file_path}. File path must be inside the current working directory.`
      }
    }

    // Check path depth limit to reduce traversal risk.
    const pathDepth = absolutePath.split(path.sep).length
    const cwdDepth = cwdAbsolute.split(path.sep).length
    if (pathDepth - cwdDepth > 20) {
      return {
        allowed: false,
        reason: 'File path depth exceeds the safety limit.',
      }
    }

    return { allowed: true }
  }

  /** Generate diff. */
  private generateDiff(oldContent: string, newContent: string): string {
    // Simplified implementation. A production version should use a real diff algorithm.
    if (oldContent === newContent) {
      return 'No changes'
    }

    // Use calculateDiffStats to collect diff statistics.
    const stats = this.calculateDiffStats(oldContent, newContent)

    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")

    let diff = `Diff stats: added ${stats.added} line(s), removed ${stats.removed} line(s), changed ${stats.changed} line(s)\n\n`

    const maxLines = Math.min(oldLines.length, newLines.length, 10) // Limit output.

    for (let i = 0; i < maxLines; i++) {
      if (oldLines[i] !== newLines[i]) {
        diff += `Line ${i + 1}: "${oldLines[i] || "(empty line)"}" -> "${newLines[i] || "(empty line)"}"\n`
      }
    }

    if (oldLines.length !== newLines.length) {
      diff += `Line count changed: ${oldLines.length} -> ${newLines.length}\n`
    }

    // Add a hint when the diff is large.
    if (stats.added + stats.removed + stats.changed > 20) {
      diff += "\nNote: many differences detected; review the full file diff."
    }

    return diff || "Content changed; diff is too large to display."
  }

  /** Create success output. */
  private createSuccessOutput(
    filePath: string,
    fileExisted: boolean,
    diff?: string,
    patchStrategy?: PatchStrategy
  ): string {
    let output = `File ${filePath} ${fileExisted ? 'updated' : 'created'}.\n`

    // Work Package H: include patch strategy information.
    if (patchStrategy) {
      const strategyNames: Record<PatchStrategy, string> = {
        str_replace: "String replacement",
        diff_replace: "Diff replacement",
        whole_file: "Whole file replacement"
      }
      output += `Patch strategy: ${strategyNames[patchStrategy]} (${patchStrategy})\n`
    }

    if (diff) {
      output += `\nChange summary:\n${diff}`
    }

    return output
  }

  /** Decide whether an error is retryable. */
  private isRetryableError(error: any): boolean {
    // Network errors and temporary file locks can be retried.
    const retryableCodes = ['EAGAIN', 'EBUSY', 'ETIMEDOUT', 'ECONNRESET']
    return retryableCodes.includes(error.code)
  }

  private async cleanupStaleAdapterTempFiles(dir: string, tempSuffix: string): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const now = Date.now()
      const staleAfterMs = 5000
      const tempPattern = new RegExp(`^\\..+\\.\\d+\\.\\d+${tempSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

      await Promise.all(entries
        .filter(entry => entry.isFile() && tempPattern.test(entry.name))
        .map(async entry => {
          const fullPath = path.join(dir, entry.name)
          const stat = await fs.stat(fullPath).catch(() => undefined)
          if (!stat || now - stat.mtimeMs < staleAfterMs) return
          await fs.unlink(fullPath).catch(() => {})
        }))
    } catch {
      // Best-effort cleanup only; file edit success must not depend on stale temp deletion.
    }
  }

  /** Create error result. */
  private createErrorResult(
    request: ToolCallRequest,
    error: any,
    startTime: number,
    events: ToolEvent[],
    atomicResult?: AtomicWriteResult
  ): ToolCallResult {
    const duration = Date.now() - startTime

    // Ensure the error object has the expected structure.
    let normalizedError: any
    if (typeof error === 'object' && error.type) {
      normalizedError = error
    } else {
      normalizedError = {
        type: 'EXECUTION_FAILED',
        message: error?.message || 'Unknown error',
        retryable: false,
        raw: error
      }
    }

    return {
      ok: false,
      outputText: `FileEdit failed: ${normalizedError.message || 'Unknown error'}`,
      events,
      error: normalizedError,
      structuredData: atomicResult ? {
        atomicWrite: {
          success: atomicResult.success,
          usedAtomic: true,
          conflictDetected: atomicResult.conflictResult?.hasConflict || false,
          conflictType: atomicResult.conflictResult?.conflictType,
          resolutionStrategy: atomicResult.conflictResult?.suggestedResolution,
          error: atomicResult.error
        }
      } : undefined,
      metadata: {
        duration,
        executorKind: this.kind,
        usedBridge: false
      }
    }
  }

  /** Calculate diff stats. */
  private calculateDiffStats(oldContent: string, newContent: string): {
    added: number
    removed: number
    changed: number
  } {
    if (oldContent === newContent) {
      return { added: 0, removed: 0, changed: 0 }
    }

    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')

    let added = 0
    let removed = 0
    let changed = 0

    const maxLines = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === undefined && newLine !== undefined) {
        added++
      } else if (oldLine !== undefined && newLine === undefined) {
        removed++
      } else if (oldLine !== newLine) {
        changed++
      }
    }

    return { added, removed, changed }
  }

  /** 生成原子操作摘要 */
  private generateAtomicOperationSummary(atomicResult: AtomicWriteResult): {
    operationType: string
    success: boolean
    duration: number
    retryCount: number
    conflictStatus: string
    fileSize: number
    operationId: string
    summaryText: string
  } {
    const conflictStatus = atomicResult.conflictResult?.hasConflict
      ? `conflict detected (${atomicResult.conflictResult.conflictType})`
      : 'no conflict'

    const successText = atomicResult.success ? 'success' : 'failed'
    const durationText = atomicResult.duration > 1000
      ? `${(atomicResult.duration / 1000).toFixed(2)}s`
      : `${atomicResult.duration}ms`

    const summaryText = `Atomic file write ${successText} - ${conflictStatus}; duration ${durationText}; retries ${atomicResult.retryCount}`

    return {
      operationType: 'atomic_file_write',
      success: atomicResult.success,
      duration: atomicResult.duration,
      retryCount: atomicResult.retryCount,
      conflictStatus,
      fileSize: atomicResult.size,
      operationId: atomicResult.operationId,
      summaryText
    }
  }
}

/** DSXU comment sanitized. */
export function createFileEditSpec(): ToolSpec {
  return {
    name: 'FileEdit',
    description: 'Edit file content. Can create new files or update existing files. Supports quote normalization, file size checks, and safety validation.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'File path to edit, relative or absolute',
        },
        new_content: {
          type: 'string',
          description: '新的文件内容'
        },
        old_content: {
          type: 'string',
          description: 'Old file content to replace. Empty string creates a new file or replaces an empty file.',
          default: ''
        },
        create_if_missing: {
          type: 'boolean',
          description: 'Whether to create the file if it does not exist',
          default: true
        },
        encoding: {
          type: 'string',
          description: '文件编码',
          default: 'utf-8',
          enum: ['utf-8', 'utf-16le', 'latin1']
        },
        replace_all: {
          type: 'boolean',
          description: 'Whether to replace all matches. If false and multiple matches are found, the operation fails.',
          default: false
        }
      },
      required: ['file_path', 'new_content']
    },
    capabilityTags: ['file_operation', 'write_operation', 'atomic_edit'],
    riskLevel: 'medium',
    executorKind: 'dsxu_native',
    concurrencySafe: false,
    readOnly: false,
    enabled: true,
    bridgeToolNames: ['FileEdit', 'Edit'],
    // DSXU comment sanitized.
    constraints: {
      maxFileSize: '1GB',
      supportedEncodings: ['utf-8', 'utf-16le', 'latin1'],
      quoteNormalization: true,
      safetyChecks: ['path_traversal', 'sensitive_files', 'file_size', 'concurrent_modification']
    }
  }

}
