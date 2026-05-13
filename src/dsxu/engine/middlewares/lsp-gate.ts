/**
 * V14 FROZEN: zero-mainline LSP gate experiment retained only because Windows
 * ACL blocked physical removal after copying to _deleted_files.
 *
 * LSP门禁中间件 - 静态拓扑感知
 * 
 * 功能：
 * 1. 在高风险工具调用前强制执行LSP检查
 * 2. 检查Go to Definition和Find All References
 * 3. 若LSP不可用，降级但记录lsp_gate_skipped
 * 4. 输出lsp_gate_passed/lsp_gate_failed事件
 */

import type { ToolBusContext, MiddlewareFunction } from '../tool-bus/types'

export interface LSPGateMiddlewareOptions {
  /** 是否启用LSP门禁 */
  enabled?: boolean
  /** 高风险工具列表 */
  highRiskTools?: string[]
  /** LSP操作超时时间（毫秒） */
  lspTimeoutMs?: number
  /** 是否在LSP不可用时降级 */
  degradeOnLSPUnavailable?: boolean
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 检查工具是否为高风险工具
 */
function isHighRiskTool(toolName: string, highRiskTools: string[]): boolean {
  return highRiskTools.includes(toolName)
}

/**
 * 检查LSP是否可用
 */
async function checkLSPAvailable(cwd: string, timeoutMs: number): Promise<boolean> {
  try {
    // 尝试简单的LSP操作来检查可用性
    const { spawn } = await import('child_process')
    
    // 检查TypeScript编译器是否可用
    const tscCheck = spawn('tsc', ['--version'], { cwd, timeout: timeoutMs })
    
    return new Promise((resolve) => {
      tscCheck.on('close', (code) => {
        resolve(code === 0)
      })
      
      tscCheck.on('error', () => {
        resolve(false)
      })
      
      setTimeout(() => {
        tscCheck.kill()
        resolve(false)
      }, timeoutMs)
    })
  } catch (error) {
    return false
  }
}

/**
 * 执行LSP检查
 */
async function performLSPCheck(
  toolName: string,
  filePath: string,
  line: number,
  character: number,
  cwd: string,
  timeoutMs: number
): Promise<{ passed: boolean; reason: string; details?: any }> {
  try {
    // 这里应该调用实际的LSP工具
    // 由于LSP工具已经存在，我们可以模拟调用
    
    const lspModule = await import('../lsp-tool.ts')
    
    // 执行Go to Definition检查
    const definitionResult = await lspModule.LSPTool.execute(
      { 
        operation: 'goToDefinition',
        file_path: filePath,
        line,
        character
      },
      { cwd, toolUseId: 'lsp-gate-check' }
    )
    
    if (definitionResult.isError) {
      return {
        passed: false,
        reason: `Go to Definition failed: ${definitionResult.content}`,
        details: definitionResult
      }
    }
    
    // 执行Find All References检查
    const referencesResult = await lspModule.LSPTool.execute(
      { 
        operation: 'findReferences',
        file_path: filePath,
        line,
        character
      },
      { cwd, toolUseId: 'lsp-gate-check' }
    )
    
    if (referencesResult.isError) {
      return {
        passed: false,
        reason: `Find All References failed: ${referencesResult.content}`,
        details: referencesResult
      }
    }
    
    return {
      passed: true,
      reason: 'LSP checks passed',
      details: {
        definition: definitionResult,
        references: referencesResult
      }
    }
    
  } catch (error: any) {
    return {
      passed: false,
      reason: `LSP check error: ${error.message}`,
      details: error
    }
  }
}

/**
 * 创建LSP门禁中间件
 */
export function createLSPGateMiddleware(options?: LSPGateMiddlewareOptions): MiddlewareFunction {
  const config = {
    enabled: options?.enabled ?? true,
    highRiskTools: options?.highRiskTools ?? ['Write', 'Edit', 'Bash', 'Git'],
    lspTimeoutMs: options?.lspTimeoutMs ?? 5000,
    degradeOnLSPUnavailable: options?.degradeOnLSPUnavailable ?? true,
    debug: options?.debug ?? false,
  }

  return async (context: ToolBusContext, next: () => Promise<void>): Promise<void> => {
    // 只处理工具使用事件
    if (!context.event.startsWith('tool:') || context.event !== 'tool:pre-use') {
      await next()
      return
    }

    const toolName = context.data?.toolName
    if (!toolName || !isHighRiskTool(toolName, config.highRiskTools)) {
      // 不是高风险工具，跳过LSP检查
      await next()
      return
    }

    if (!config.enabled) {
      // LSP门禁未启用
      if (config.debug) {
        console.log(`[LSPGate] Disabled, skipping check for tool: ${toolName}`)
      }
      await next()
      return
    }

    // 检查LSP是否可用
    const lspAvailable = await checkLSPAvailable(context.metadata.cwd, config.lspTimeoutMs)
    
    if (!lspAvailable) {
      // LSP不可用
      if (config.degradeOnLSPUnavailable) {
        // 降级：记录跳过事件，继续执行
        context.lspGate = {
          skipped: true,
          reason: 'LSP unavailable',
          timestamp: Date.now(),
        }
        
        // 触发lsp_gate_skipped事件
        context.events = context.events || []
        context.events.push({
          type: 'lsp_gate_skipped',
          timestamp: Date.now(),
          data: {
            toolName,
            reason: 'LSP unavailable',
            cwd: context.metadata.cwd,
          }
        })
        
        if (config.debug) {
          console.log(`[LSPGate] LSP unavailable, skipping check for tool: ${toolName}`)
        }
        
        await next()
        return
      } else {
        // 不降级：抛出错误
        throw new Error(`LSP gate check failed: LSP unavailable for tool ${toolName}`)
      }
    }

    // 提取文件路径和位置信息（从工具输入中）
    const toolInput = context.data?.toolInput || {}
    const filePath = toolInput.file_path || toolInput.path
    const line = toolInput.line || 1
    const character = toolInput.character || 1

    if (!filePath) {
      // 没有文件路径信息，跳过检查
      context.lspGate = {
        skipped: true,
        reason: 'No file path in tool input',
        timestamp: Date.now(),
      }
      
      await next()
      return
    }

    // 执行LSP检查
    const startTime = Date.now()
    const checkResult = await performLSPCheck(toolName, filePath, line, character, context.metadata.cwd, config.lspTimeoutMs)
    const duration = Date.now() - startTime

    // 记录检查结果
    context.lspGate = {
      checked: true,
      passed: checkResult.passed,
      duration,
      reason: checkResult.reason,
      details: checkResult.details,
      timestamp: Date.now(),
    }

    // 触发相应的事件
    const eventType = checkResult.passed ? 'lsp_gate_passed' : 'lsp_gate_failed'
    context.events = context.events || []
    context.events.push({
      type: eventType,
      timestamp: Date.now(),
      data: {
        toolName,
        filePath,
        line,
        character,
        passed: checkResult.passed,
        reason: checkResult.reason,
        duration,
        cwd: context.metadata.cwd,
      }
    })

    if (config.debug) {
      console.log(`[LSPGate] ${eventType} for tool ${toolName}: ${checkResult.reason} (${duration}ms)`)
    }

    if (!checkResult.passed) {
      // LSP检查失败，阻止工具执行
      context.continue = false
      context.error = new Error(`LSP gate check failed: ${checkResult.reason}`)
      context.result = {
        error: `LSP gate check failed: ${checkResult.reason}`,
        details: checkResult.details,
      }
      return
    }

    // LSP检查通过，继续执行
    await next()
  }
}

/**
 * 创建完整的LSP门禁中间件对象
 */
export function createLSPGateMiddlewareObject(options?: LSPGateMiddlewareOptions) {
  return {
    name: 'lsp-gate',
    description: 'Performs LSP checks before high-risk tool executions',
    priority: 50, // 高优先级，在错误处理之后，其他中间件之前
    match: 'tool:pre-use', // 只匹配工具使用前事件
    execute: createLSPGateMiddleware(options),
    enabled: true,
  }
}
