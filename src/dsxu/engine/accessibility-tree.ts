/**
 * #5.5 Accessibility Tree — 无障碍树结构提取
 *
 * 为 LLM 提供 UI 结构理解能力：
 *   1. 解析 HTML → 简化 Accessibility Tree
 *   2. 提取语义元素（headings, forms, links, buttons, landmarks）
 *   3. 输出 LLM 可理解的结构化文本
 *
 * 用途：
 *   - Computer use 场景：LLM 需要理解页面结构
 *   - Web 测试：检查 accessibility 合规性
 *   - UI 自动化：定位交互元素
 *
 * 注册为 ToolDefinition，可通过 MCP 或直接调用。
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'

// ── Accessibility Node ──

export interface A11yNode {
  /** ARIA role 或推断的语义角色 */
  role: string
  /** 可见名称（text content / aria-label / alt） */
  name: string
  /** 嵌套层级 */
  level: number
  /** 子节点 */
  children: A11yNode[]
  /** 额外属性 */
  properties: Record<string, string>
  /** 原始 HTML 标签 */
  tag: string
}

// ── HTML Tag → ARIA Role Mapping ──

const TAG_TO_ROLE: Record<string, string> = {
  'header': 'banner',
  'nav': 'navigation',
  'main': 'main',
  'footer': 'contentinfo',
  'aside': 'complementary',
  'section': 'region',
  'article': 'article',
  'form': 'form',
  'button': 'button',
  'a': 'link',
  'input': 'textbox',
  'textarea': 'textbox',
  'select': 'combobox',
  'img': 'img',
  'table': 'table',
  'tr': 'row',
  'th': 'columnheader',
  'td': 'cell',
  'ul': 'list',
  'ol': 'list',
  'li': 'listitem',
  'h1': 'heading',
  'h2': 'heading',
  'h3': 'heading',
  'h4': 'heading',
  'h5': 'heading',
  'h6': 'heading',
  'dialog': 'dialog',
  'details': 'group',
  'summary': 'button',
  'label': 'label',
  'fieldset': 'group',
  'legend': 'legend',
  'progress': 'progressbar',
  'meter': 'meter',
  'output': 'status',
}

/** 需要跳过的非语义标签 */
const SKIP_TAGS = new Set([
  'script', 'style', 'link', 'meta', 'head', 'br', 'hr', 'wbr',
  'noscript', 'template', 'slot',
])

/** 具有隐含语义的输入类型 */
const INPUT_TYPE_ROLES: Record<string, string> = {
  'checkbox': 'checkbox',
  'radio': 'radio',
  'range': 'slider',
  'search': 'searchbox',
  'email': 'textbox',
  'tel': 'textbox',
  'url': 'textbox',
  'number': 'spinbutton',
  'submit': 'button',
  'reset': 'button',
  'button': 'button',
}

// ── HTML Parser (lightweight, regex-based) ──

interface ParsedElement {
  tag: string
  attrs: Record<string, string>
  selfClosing: boolean
  textContent: string
  children: ParsedElement[]
}

/**
 * 轻量级 HTML → Accessibility Tree 解析器
 *
 * 不用 DOM parser 依赖，用 regex + 状态机解析 HTML 结构。
 * 对于标准 HTML 足够精确；对于 malformed HTML 尽力而为。
 */
export function parseHTMLToA11yTree(html: string): A11yNode {
  const root: A11yNode = {
    role: 'document',
    name: '',
    level: 0,
    children: [],
    properties: {},
    tag: 'html',
  }

  // Simplified approach: extract semantic elements via regex
  const elements = extractSemanticElements(html)

  for (const elem of elements) {
    const node = elementToA11yNode(elem, 1)
    if (node) {
      root.children.push(node)
    }
  }

  return root
}

interface SemanticElement {
  tag: string
  attrs: Record<string, string>
  textContent: string
  raw: string
}

/**
 * 从 HTML 提取语义相关的元素
 */
function extractSemanticElements(html: string): SemanticElement[] {
  const elements: SemanticElement[] = []

  const semanticTags = Object.keys(TAG_TO_ROLE).join('|')

  // Pattern 1: Self-closing tags (input, img, etc.)
  const selfClosingPattern = new RegExp(
    `<(${semanticTags})(\\s[^>]*?)\\s*\\/?>(?!.*<\\/\\1>)`,
    'gi',
  )

  // Pattern 2: Open/close tag pairs
  const pairPattern = new RegExp(
    `<(${semanticTags})(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>`,
    'gi',
  )

  // Collect self-closing elements
  let match
  while ((match = selfClosingPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const attrStr = match[2] || ''

    if (SKIP_TAGS.has(tag)) continue
    const attrs = parseAttributes(attrStr)
    if (attrs['aria-hidden'] === 'true' || attrs['hidden'] !== undefined) continue

    elements.push({ tag, attrs, textContent: '', raw: match[0] })
  }

  // Collect paired elements
  while ((match = pairPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const attrStr = match[2] || ''
    const inner = match[3] || ''

    if (SKIP_TAGS.has(tag)) continue
    const attrs = parseAttributes(attrStr)
    if (attrs['aria-hidden'] === 'true' || attrs['hidden'] !== undefined) continue

    const textContent = inner.replace(/<[^>]+>/g, '').trim().slice(0, 200)
    elements.push({ tag, attrs, textContent, raw: match[0] })
  }

  return elements
}

/**
 * 解析 HTML 属性字符串
 */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrPattern = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let match
  while ((match = attrPattern.exec(attrStr)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attrs
}

/**
 * 将 HTML 元素转为 A11y 节点
 */
function elementToA11yNode(elem: SemanticElement, level: number): A11yNode | null {
  const { tag, attrs, textContent } = elem

  // Determine role
  let role = attrs['role'] || TAG_TO_ROLE[tag] || 'generic'

  // Special handling for input types
  if (tag === 'input' && attrs['type']) {
    role = INPUT_TYPE_ROLES[attrs['type']] || 'textbox'
  }

  // Determine accessible name
  let name = attrs['aria-label']
    || attrs['alt']
    || attrs['title']
    || attrs['placeholder']
    || textContent
    || ''

  // For headings, include level
  const properties: Record<string, string> = {}
  if (tag.match(/^h[1-6]$/)) {
    properties['level'] = tag[1]
  }

  // For inputs, include type and state
  if (tag === 'input') {
    if (attrs['type']) properties['type'] = attrs['type']
    if (attrs['disabled'] !== undefined) properties['disabled'] = 'true'
    if (attrs['required'] !== undefined) properties['required'] = 'true'
    if (attrs['value']) properties['value'] = attrs['value'].slice(0, 50)
  }

  // For links, include href
  if (tag === 'a' && attrs['href']) {
    properties['url'] = attrs['href'].slice(0, 100)
  }

  // For images, include src
  if (tag === 'img' && attrs['src']) {
    properties['src'] = attrs['src'].slice(0, 100)
  }

  // ARIA states
  if (attrs['aria-expanded']) properties['expanded'] = attrs['aria-expanded']
  if (attrs['aria-checked']) properties['checked'] = attrs['aria-checked']
  if (attrs['aria-selected']) properties['selected'] = attrs['aria-selected']
  if (attrs['aria-disabled']) properties['disabled'] = attrs['aria-disabled']

  // For form elements, include id for association
  if (attrs['id']) properties['id'] = attrs['id']

  return {
    role,
    name: name.slice(0, 200),
    level,
    children: [],
    properties,
    tag,
  }
}

// ── A11y Tree → Text Format ──

/**
 * 将 A11y 树渲染为 LLM 可读文本
 */
export function renderA11yTree(node: A11yNode, indent: number = 0): string {
  const prefix = '  '.repeat(indent)
  const lines: string[] = []

  // Format: [role] "name" {properties}
  let line = `${prefix}[${node.role}]`
  if (node.name) {
    line += ` "${node.name}"`
  }

  const propEntries = Object.entries(node.properties)
  if (propEntries.length > 0) {
    line += ` {${propEntries.map(([k, v]) => `${k}=${v}`).join(', ')}}`
  }

  lines.push(line)

  for (const child of node.children) {
    lines.push(renderA11yTree(child, indent + 1))
  }

  return lines.join('\n')
}

/**
 * 统计 A11y 树的元素数量
 */
export function countA11yNodes(node: A11yNode): number {
  let count = 1
  for (const child of node.children) {
    count += countA11yNodes(child)
  }
  return count
}

/**
 * 检查基本 accessibility 问题
 */
export function checkA11yIssues(html: string): string[] {
  const issues: string[] = []

  // Images without alt
  const imgNoAlt = html.match(/<img(?![^>]*alt=)[^>]*>/gi)
  if (imgNoAlt) {
    issues.push(`${imgNoAlt.length} image(s) missing alt text`)
  }

  // Buttons/links without accessible name
  const emptyButtons = html.match(/<button[^>]*>\s*<\/button>/gi)
  if (emptyButtons) {
    issues.push(`${emptyButtons.length} button(s) with no accessible name`)
  }

  const emptyLinks = html.match(/<a[^>]*>\s*<\/a>/gi)
  if (emptyLinks) {
    issues.push(`${emptyLinks.length} link(s) with no accessible name`)
  }

  // Missing lang attribute on html
  if (html.includes('<html') && !/<html[^>]*lang=/i.test(html)) {
    issues.push('Missing lang attribute on <html> element')
  }

  // Missing form labels
  const inputs = html.match(/<input(?![^>]*type=["']hidden)[^>]*>/gi) || []
  const unlabeled = inputs.filter(inp =>
    !inp.includes('aria-label') && !inp.includes('id='),
  )
  if (unlabeled.length > 0) {
    issues.push(`${unlabeled.length} input(s) possibly missing labels`)
  }

  // Heading hierarchy issues
  const headings = [...html.matchAll(/<h(\d)/gi)].map(m => parseInt(m[1]))
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      issues.push(`Heading hierarchy skip: h${headings[i - 1]} → h${headings[i]}`)
    }
  }

  return issues
}

// ── Tool Definition ──

export const AccessibilityTreeTool: ToolDefinition = {
  name: 'AccessibilityTree',
  description: `Parse HTML content into an accessibility tree structure. Extracts semantic elements (headings, links, buttons, forms, landmarks) and their properties. Use for understanding page structure, accessibility auditing, or UI automation targeting.`,
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML content to parse',
      },
      url: {
        type: 'string',
        description: 'URL to fetch and parse (alternative to html)',
      },
      check_issues: {
        type: 'boolean',
        description: 'Also check for accessibility issues (default: false)',
      },
    },
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    let html = input.html as string

    // Fetch from URL if provided
    if (!html && input.url) {
      try {
        const resp = await fetch(input.url as string, {
          headers: { 'User-Agent': 'DSxu/1.0 A11y-Scanner' },
          signal: AbortSignal.timeout(10_000),
        })
        html = await resp.text()
      } catch (error: any) {
        return { content: `Failed to fetch URL: ${error.message}`, isError: true }
      }
    }

    if (!html) {
      return { content: 'No HTML content or URL provided.', isError: true }
    }

    try {
      const tree = parseHTMLToA11yTree(html)
      const nodeCount = countA11yNodes(tree)
      const rendered = renderA11yTree(tree)

      const lines: string[] = [
        '# Accessibility Tree',
        `Elements: ${nodeCount}`,
        '',
        rendered,
      ]

      // Optional: check for issues
      if (input.check_issues) {
        const issues = checkA11yIssues(html)
        if (issues.length > 0) {
          lines.push('')
          lines.push('## Accessibility Issues')
          for (const issue of issues) {
            lines.push(`  ⚠️ ${issue}`)
          }
        } else {
          lines.push('')
          lines.push('## ✅ No accessibility issues detected')
        }
      }

      return {
        content: lines.join('\n'),
        meta: {
          nodeCount,
          issueCount: input.check_issues ? checkA11yIssues(html).length : 0,
        },
      }
    } catch (error: any) {
      return { content: `A11y tree parsing failed: ${error.message}`, isError: true }
    }
  },
}
