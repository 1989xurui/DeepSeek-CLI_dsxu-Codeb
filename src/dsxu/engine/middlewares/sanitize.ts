/**
 * Legacy zero-import middleware retained only because Windows ACL blocked
 * physical removal after copying to _deleted_files.
 *
 * Sanitize 中间件 - ANSI清洗 + 长度截断
 * 
 * 功能：
 * 1. 移除ANSI控制序列（终端颜色代码）
 * 2. 截断超长字符串结果
 * 3. 保持非字符串结果原样透传
 */

import type { ToolBusContext, MiddlewareFunction } from '../tool-bus/types'

export interface SanitizeMiddlewareOptions {
  /** 是否启用ANSI清洗 */
  enableAnsiSanitize?: boolean
  /** 清洗后的最大长度 */
  maxSanitizedLength?: number
  /** 截断提示文案 */
  truncateMessage?: string
}

/**
 * 移除ANSI控制序列
 */
function stripAnsiCodes(str: string): string {
  // 匹配ANSI控制序列的正则表达式
  // 包括：CSI序列（ESC[）、OSC序列（ESC]）、其他控制序列
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][0-9];.*?\x07/g, '')
    .replace(/\x1b[=/>]/g, '')
    .replace(/\x1b./g, '') // 其他单字符控制序列
}

/**
 * 安全截断字符串
 */
function safeTruncate(str: string, maxLength: number, truncateMessage: string): string {
  if (str.length <= maxLength) {
    return str
  }
  
  const keepLength = maxLength - truncateMessage.length
  if (keepLength <= 0) {
    return truncateMessage
  }
  
  return str.slice(0, keepLength) + truncateMessage
}

/**
 * 创建Sanitize中间件
 */
export function createSanitizeMiddleware(options?: SanitizeMiddlewareOptions): MiddlewareFunction {
  const config = {
    enableAnsiSanitize: options?.enableAnsiSanitize ?? true,
    maxSanitizedLength: options?.maxSanitizedLength ?? 15000,
    truncateMessage: options?.truncateMessage ?? `\n\n[...truncated, total length exceeded ${options?.maxSanitizedLength ?? 15000} characters]`,
  }

  return async (context: ToolBusContext, next: () => Promise<void>): Promise<void> => {
    // 先执行下一个中间件
    await next()

    // 只处理字符串类型的结果
    if (typeof context.result === 'string') {
      let sanitized = context.result

      // 1. 移除ANSI控制序列
      if (config.enableAnsiSanitize) {
        const originalLength = sanitized.length
        sanitized = stripAnsiCodes(sanitized)
        
        if (sanitized.length !== originalLength && context.metadata.source !== 'test') {
          console.log(`[Sanitize] Removed ANSI codes from result, length reduced from ${originalLength} to ${sanitized.length}`)
        }
      }

      // 2. 长度截断
      if (sanitized.length > config.maxSanitizedLength) {
        const originalLength = sanitized.length
        sanitized = safeTruncate(sanitized, config.maxSanitizedLength, config.truncateMessage)
        
        if (context.metadata.source !== 'test') {
          console.log(`[Sanitize] Truncated result from ${originalLength} to ${sanitized.length} characters`)
        }
      }

      // 更新结果
      context.result = sanitized
      
      // 记录清洗信息到上下文
      context.sanitizeInfo = {
        ansiRemoved: config.enableAnsiSanitize,
        truncated: sanitized.length < context.result.length,
        originalLength: context.result.length,
        finalLength: sanitized.length,
      }
    }
    // 其他类型（对象、数组、Buffer等）原样透传
  }
}

/**
 * 创建完整的Sanitize中间件对象
 */
export function createSanitizeMiddlewareObject(options?: SanitizeMiddlewareOptions) {
  return {
    name: 'sanitize',
    description: 'Removes ANSI codes and truncates long string results',
    priority: 200, // 在metrics-error(100)之后，核心工具执行之前
    execute: createSanitizeMiddleware(options),
    enabled: true,
  }
}
