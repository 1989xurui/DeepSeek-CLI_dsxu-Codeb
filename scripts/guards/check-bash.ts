#!/usr/bin/env bun
/**
 * TASK-INFRA-4 Safe Shell 白名单守卫
 *
 * 防止 GNU 工具在 POSIX shell 中导致 exit 127 错误。
 * 挂在 .claude/settings.json PreToolUse matcher=Bash。
 *
 * 契约：
 * - 输入：GUARD_BASH_COMMAND 环境变量（完整命令字符串）
 * - 黑名单 token（作为独立 word 出现即拒绝并 exit 2）：
 *   head tail wc cut sort uniq xargs awk sed
 * - 管道 | 只允许连接白名单命令：git bun node powershell findstr Select-Object
 * - 拒绝时写 .dsevo/incidents/bash-block-<ts>.md
 * - exit 2 让 Claude Code 把 stderr 作为错误返回给模型
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

// 黑名单 token - 作为独立 word 出现即拒绝
const BLACKLIST_TOKENS = new Set([
  'head',
  'tail',
  'wc',
  'cut',
  'sort',
  'uniq',
  'xargs',
  'awk',
  'sed',
  'rm',  // 根据TASK-ADDENDUM.md反例添加
  'grep',
  'find'
])

// 管道白名单命令 - 管道 | 只允许连接这些命令
const PIPELINE_ALLOWLIST = new Set([
  'git',
  'bun',
  'node',
  'powershell',
  'findstr',
  'Select-Object'
])


/**
 * 检查命令是否包含黑名单 token
 */
function containsBlacklistedToken(command: string): { found: boolean; token?: string } {
  // 更精确的分词逻辑：按空格、管道、重定向、分号等分割
  // 但要注意不要分割引号内的内容
  const tokens: string[] = []
  let currentToken = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (escaped) {
      currentToken += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      currentToken += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      currentToken += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      currentToken += char
      continue
    }

    // 如果是分隔符且不在引号内
    if (!inSingleQuote && !inDoubleQuote && /[\s|&;()<>`]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken)
        currentToken = ''
      }
      // 跳过分隔符
      continue
    }

    currentToken += char
  }

  // 添加最后一个token
  if (currentToken) {
    tokens.push(currentToken)
  }

  // 检查token
  for (const token of tokens) {
    // 移除可能的引号
    let cleanToken = token.trim().toLowerCase()
    if ((cleanToken.startsWith("'") && cleanToken.endsWith("'")) ||
        (cleanToken.startsWith('"') && cleanToken.endsWith('"'))) {
      cleanToken = cleanToken.slice(1, -1)
    }

    if (BLACKLIST_TOKENS.has(cleanToken)) {
      return { found: true, token: cleanToken }
    }
  }

  return { found: false }
}

/**
 * 提取命令的第一个单词（考虑引号）
 */
function extractFirstWord(commandPart: string): string | null {
  let firstWord = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < commandPart.length; i++) {
    const char = commandPart[i]

    if (escaped) {
      firstWord += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    // 如果是空格且不在引号内，结束第一个单词
    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (firstWord) {
        break
      }
      continue // 跳过前导空格
    }

    firstWord += char
  }

  return firstWord.toLowerCase() || null
}

/**
 * 检查管道命令是否合法
 */
function validatePipeline(command: string): { valid: boolean; reason?: string } {
  // 如果没有管道，直接通过
  if (!command.includes('|')) {
    return { valid: true }
  }

  // 分割管道命令（考虑引号）
  const pipelineParts: string[] = []
  let currentPart = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (escaped) {
      currentPart += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      currentPart += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      currentPart += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      currentPart += char
      continue
    }

    // 如果是管道且不在引号内
    if (char === '|' && !inSingleQuote && !inDoubleQuote) {
      pipelineParts.push(currentPart.trim())
      currentPart = ''
      continue
    }

    currentPart += char
  }

  // 添加最后一部分
  if (currentPart) {
    pipelineParts.push(currentPart.trim())
  }

  // 检查每个管道部分
  for (let i = 0; i < pipelineParts.length; i++) {
    const part = pipelineParts[i]
    if (!part) {
      return {
        valid: false,
        reason: `管道部分 ${i + 1} 为空`
      }
    }

    // 提取命令（第一个单词）
    const firstWord = extractFirstWord(part)

    if (!firstWord) {
      return {
        valid: false,
        reason: `管道部分 ${i + 1} 无法提取命令: "${part}"`
      }
    }

    // 检查是否在白名单中
    if (!PIPELINE_ALLOWLIST.has(firstWord)) {
      return {
        valid: false,
        reason: `管道命令 "${firstWord}" 不在白名单中`
      }
    }
  }

  return { valid: true }
}


/**
 * 记录拒绝事件到 incidents 目录
 */
function logIncident(command: string, reason: string): void {
  const incidentsDir = '.dsevo/incidents'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `bash-block-${timestamp}.md`
  const filepath = join(incidentsDir, filename)

  // 创建目录
  if (!existsSync(incidentsDir)) {
    mkdirSync(incidentsDir, { recursive: true })
  }

  const content = `# Bash 命令被阻止

**时间**: ${new Date().toISOString()}
**命令**: \`${command}\`
**原因**: ${reason}

## 建议
请使用以下 Claude Code 工具代替 GNU shell 命令：

- 使用 \`Read\` 工具代替 \`cat\`、\`head\`、\`tail\`
- 使用 \`Grep\` 工具代替 \`grep\`
- 使用 \`Glob\` 工具代替 \`find\`、\`ls\` 文件搜索
- 使用 \`Edit\` 工具代替 \`sed\`、\`awk\`

这些工具提供更好的安全性和用户体验。
`

  writeFileSync(filepath, content)
  console.error(`[R-SHELL-VIOLATION] 事件已记录到: ${filepath}`)
}

function main() {
  const command = process.env.GUARD_BASH_COMMAND

  if (!command) {
    console.error('错误: GUARD_BASH_COMMAND 环境变量未设置')
    process.exit(1)
  }

  console.error(`检查命令: ${command}`)

  // 检查黑名单 token
  const blacklistCheck = containsBlacklistedToken(command)
  if (blacklistCheck.found) {
    const reason = `包含黑名单 token: "${blacklistCheck.token}"`
    console.error(`拒绝: ${reason}`)
    logIncident(command, reason)
    console.error('[R-SHELL-VIOLATION] 请使用 Read/Grep/Glob 工具代替 GNU 工具')
    process.exit(2)
  }

  // 检查管道命令
  const pipelineCheck = validatePipeline(command)
  if (!pipelineCheck.valid) {
    const reason = `管道验证失败: ${pipelineCheck.reason}`
    console.error(`拒绝: ${reason}`)
    logIncident(command, reason)
    console.error('[R-SHELL-VIOLATION] 请使用 Read/Grep/Glob 工具代替 GNU 工具')
    process.exit(2)
  }

  // 如果没有管道，且不包含黑名单token，就允许
  // 因为主要风险是管道到GNU工具
  if (!command.includes('|')) {
    // 已经检查过黑名单token，所以这里直接通过
    console.error('命令检查通过（无管道且无黑名单token）')
    process.exit(0)
  }

  // 所有检查通过
  console.error('命令检查通过')
  process.exit(0)
}

if (require.main === module) {
  main()
}