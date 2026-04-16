/**
 * Frontmatter Parser
 *
 * 解析 YAML frontmatter + body，支持异常容错
 * 格式：
 * ---
 * title: 文档标题
 * tags: [tag1, tag2]
 * priority: 1
 * ---
 * 正文内容...
 */

export interface FrontmatterResult {
  /** 解析出的 frontmatter 对象（可能为空） */
  frontmatter: Record<string, any>
  /** 正文内容（去除 frontmatter 部分） */
  body: string
  /** 是否包含有效的 frontmatter */
  hasFrontmatter: boolean
  /** 解析错误信息（如果有） */
  error?: string
}

/**
 * 解析文本中的 YAML frontmatter
 *
 * @param text 输入文本
 * @returns 解析结果，包含 frontmatter 和 body
 */
export function parseFrontmatter(text: string): FrontmatterResult {
  // 空文本处理
  if (!text || text.trim() === '') {
    return {
      frontmatter: {},
      body: '',
      hasFrontmatter: false,
    }
  }

  const lines = text.split('\n')

  // 检查是否以 frontmatter 分隔符开头
  if (lines[0]?.trim() !== '---') {
    return {
      frontmatter: {},
      body: text,
      hasFrontmatter: false,
    }
  }

  let frontmatterLines: string[] = []
  let bodyLines: string[] = []
  let inFrontmatter = false
  let frontmatterEnded = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true
      continue
    }

    if (inFrontmatter && !frontmatterEnded) {
      if (trimmed === '---') {
        frontmatterEnded = true
        inFrontmatter = false
        continue
      }
      frontmatterLines.push(line)
    } else {
      bodyLines.push(line)
    }
  }

  // 如果没有找到结束分隔符，则整个文本都是 body
  if (!frontmatterEnded) {
    return {
      frontmatter: {},
      body: text,
      hasFrontmatter: false,
      error: 'Frontmatter not properly closed',
    }
  }

  // 解析 YAML
  const frontmatterText = frontmatterLines.join('\n')
  let frontmatter: Record<string, any> = {}
  let error: string | undefined

  try {
    if (frontmatterText.trim()) {
      // 简单 YAML 解析（支持 key: value 格式）
      frontmatter = parseSimpleYaml(frontmatterText)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to parse YAML'
    // 出错时返回空 frontmatter，但保留 body
  }

  return {
    frontmatter,
    body: bodyLines.join('\n'),
    hasFrontmatter: Object.keys(frontmatter).length > 0,
    error,
  }
}

/**
 * 简单 YAML 解析器
 * 支持：
 * - key: value
 * - key: "quoted value"
 * - key: [item1, item2]
 * - key: {nested: value}
 * - 多行字符串（| 或 >）
 */
function parseSimpleYaml(yamlText: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = yamlText.split('\n')
  let currentKey: string | null = null
  let multilineValue: string[] = []
  let inMultiline = false
  let multilineType: '|' | '>' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 跳过空行和注释
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    // 处理多行字符串
    if (inMultiline) {
      // 检查是否遇到下一个键或frontmatter结束
      if (line.trim() === '---' || line.includes(':')) {
        // 多行字符串结束
        inMultiline = false
        if (currentKey && multilineValue.length > 0) {
          // 移除每行的前2个空格（标准YAML缩进）
          const processedLines = multilineValue.map(l => l.replace(/^ {2}/, ''))
          const value = multilineType === '>'
            ? processedLines.join(' ').trim()
            : processedLines.join('\n').trim()
          result[currentKey] = value
        }
        currentKey = null
        multilineValue = []
        multilineType = null

        // 重新处理当前行
        i--
        continue
      }

      // 多行字符串内容：保持原样（包括缩进）
      multilineValue.push(line)
      continue
    }

    // 检查是否为多行字符串开始
    const colonIndex = line.indexOf(':')
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim()
      const valuePart = line.slice(colonIndex + 1).trim()

      if (valuePart === '|' || valuePart === '>') {
        // 多行字符串开始
        currentKey = key
        inMultiline = true
        multilineType = valuePart as '|' | '>'
        continue
      }

      // 检查是否为带缩进的多行字符串开始
      if (valuePart === '' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        if (nextLine === '|' || nextLine === '>') {
          currentKey = key
          inMultiline = true
          multilineType = nextLine as '|' | '>'
          i++ // 跳过下一行
          continue
        }
      }
    }

    // 解析普通键值对
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      result[key] = parseYamlValue(value.trim())
    } else {
      // 尝试解析中文键名
      const chineseMatch = line.match(/^([\u4e00-\u9fa5a-zA-Z0-9_-]+)\s*:\s*(.+)$/)
      if (chineseMatch) {
        const [, key, value] = chineseMatch
        result[key] = parseYamlValue(value.trim())
      }
    }
  }

  // 处理最后的多行字符串（如果frontmatter结束时还在多行字符串中）
  if (inMultiline && currentKey && multilineValue.length > 0) {
    // 移除每行的前2个空格（标准YAML缩进）
    const processedLines = multilineValue.map(l => l.replace(/^ {2}/, ''))
    const value = multilineType === '>'
      ? processedLines.join(' ').trim()
      : processedLines.join('\n').trim()
    result[currentKey] = value
  }

  return result
}

/**
 * 解析 YAML 值
 */
function parseYamlValue(value: string): any {
  // 空值
  if (value === '' || value === 'null') {
    return null
  }

  // 布尔值
  if (value === 'true') return true
  if (value === 'false') return false

  // 数字
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value)
  }

  // 数组
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value)
    } catch {
      // 简单数组解析：item1, item2, item3
      return value.slice(1, -1).split(',').map(item => item.trim()).filter(item => item !== '')
    }
  }

  // 对象
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      return JSON.parse(value)
    } catch {
      // 简单对象解析
      return {}
    }
  }

  // 引号字符串
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  // 普通字符串
  return value
}

/**
 * 从文件路径读取并解析 frontmatter
 */
export async function parseFrontmatterFromFile(filePath: string): Promise<FrontmatterResult> {
  try {
    const fs = await import('fs/promises')
    const content = await fs.readFile(filePath, 'utf-8')
    return parseFrontmatter(content)
  } catch (error) {
    return {
      frontmatter: {},
      body: '',
      hasFrontmatter: false,
      error: error instanceof Error ? error.message : 'Failed to read file',
    }
  }
}

/**
 * 将 frontmatter 和 body 组合成文本
 */
export function composeFrontmatter(frontmatter: Record<string, any>, body: string): string {
  const frontmatterLines: string[] = ['---']

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      // 跳过 undefined
      continue
    }

    if (value === null) {
      frontmatterLines.push(`${key}: null`)
    } else if (typeof value === 'boolean') {
      frontmatterLines.push(`${key}: ${value}`)
    } else if (typeof value === 'number') {
      frontmatterLines.push(`${key}: ${value}`)
    } else if (typeof value === 'string') {
      // 检查是否需要多行字符串
      if (value.includes('\n')) {
        frontmatterLines.push(`${key}: |`)
        frontmatterLines.push(...value.split('\n').map(line => `  ${line}`))
      } else {
        frontmatterLines.push(`${key}: "${value}"`)
      }
    } else if (Array.isArray(value)) {
      frontmatterLines.push(`${key}: [${value.map(v => JSON.stringify(v)).join(', ')}]`)
    } else if (typeof value === 'object') {
      frontmatterLines.push(`${key}: ${JSON.stringify(value)}`)
    }
  }

  frontmatterLines.push('---')

  return frontmatterLines.join('\n') + '\n' + body
}