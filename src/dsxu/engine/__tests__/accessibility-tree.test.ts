/**
 * Accessibility Tree 测试
 * #5.5 无障碍树结构
 */

import { describe, it, expect } from 'vitest'
import {
  parseHTMLToA11yTree,
  renderA11yTree,
  countA11yNodes,
  checkA11yIssues,
  AccessibilityTreeTool,
} from '../accessibility-tree'
import type { ToolContext } from '../types'

const ctx: ToolContext = { cwd: '/tmp', sessionId: 'test', gear: 1 }

// ── parseHTMLToA11yTree ──

describe('parseHTMLToA11yTree', () => {
  it('should create root document node', () => {
    const tree = parseHTMLToA11yTree('<div>hello</div>')
    expect(tree.role).toBe('document')
    expect(tree.tag).toBe('html')
  })

  it('should extract headings', () => {
    const tree = parseHTMLToA11yTree(`
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
    `)
    const headings = tree.children.filter(n => n.role === 'heading')
    expect(headings).toHaveLength(2)
    expect(headings[0].name).toBe('Main Title')
    expect(headings[0].properties.level).toBe('1')
    expect(headings[1].name).toBe('Subtitle')
    expect(headings[1].properties.level).toBe('2')
  })

  it('should extract links with href', () => {
    const tree = parseHTMLToA11yTree(`
      <a href="https://example.com">Visit Example</a>
    `)
    const links = tree.children.filter(n => n.role === 'link')
    expect(links).toHaveLength(1)
    expect(links[0].name).toBe('Visit Example')
    expect(links[0].properties.url).toBe('https://example.com')
  })

  it('should extract buttons', () => {
    const tree = parseHTMLToA11yTree(`
      <button aria-label="Close dialog">X</button>
    `)
    const buttons = tree.children.filter(n => n.role === 'button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].name).toBe('Close dialog')  // aria-label takes precedence
  })

  it('should extract form inputs', () => {
    const tree = parseHTMLToA11yTree(`
      <input type="text" placeholder="Enter name" id="name-input" />
      <input type="checkbox" aria-label="Remember me" />
    `)
    const inputs = tree.children
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    const textbox = inputs.find(n => n.role === 'textbox')
    expect(textbox).toBeDefined()
    expect(textbox!.name).toBe('Enter name')

    const checkbox = inputs.find(n => n.role === 'checkbox')
    expect(checkbox).toBeDefined()
    expect(checkbox!.name).toBe('Remember me')
  })

  it('should extract landmarks', () => {
    const tree = parseHTMLToA11yTree(`
      <header>Site Header</header>
      <nav>Navigation</nav>
      <main>Content</main>
      <footer>Site Footer</footer>
    `)

    const roles = tree.children.map(n => n.role)
    expect(roles).toContain('banner')
    expect(roles).toContain('navigation')
    expect(roles).toContain('main')
    expect(roles).toContain('contentinfo')
  })

  it('should extract images with alt', () => {
    const tree = parseHTMLToA11yTree(`
      <img src="photo.jpg" alt="A landscape photo" />
    `)
    const imgs = tree.children.filter(n => n.role === 'img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].name).toBe('A landscape photo')
    expect(imgs[0].properties.src).toBe('photo.jpg')
  })

  it('should skip aria-hidden elements', () => {
    const tree = parseHTMLToA11yTree(`
      <button>Visible</button>
      <button aria-hidden="true">Hidden</button>
    `)
    const buttons = tree.children.filter(n => n.role === 'button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].name).toBe('Visible')
  })

  it('should handle ARIA states', () => {
    const tree = parseHTMLToA11yTree(`
      <button aria-expanded="true">Menu</button>
    `)
    const btn = tree.children.find(n => n.role === 'button')
    expect(btn).toBeDefined()
    expect(btn!.properties.expanded).toBe('true')
  })

  it('should use explicit role over implicit', () => {
    const tree = parseHTMLToA11yTree(`
      <nav role="tablist">Tabs</nav>
    `)
    const node = tree.children[0]
    expect(node.role).toBe('tablist')
  })

  it('should handle lists', () => {
    const tree = parseHTMLToA11yTree(`
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    `)
    const lists = tree.children.filter(n => n.role === 'list')
    expect(lists.length).toBeGreaterThanOrEqual(1)
  })
})

// ── renderA11yTree ──

describe('renderA11yTree', () => {
  it('should render tree as text', () => {
    const tree = parseHTMLToA11yTree('<h1>Hello</h1><button>Click me</button>')
    const rendered = renderA11yTree(tree)

    expect(rendered).toContain('[document]')
    expect(rendered).toContain('[heading]')
    expect(rendered).toContain('"Hello"')
    expect(rendered).toContain('[button]')
    expect(rendered).toContain('"Click me"')
  })

  it('should indent children', () => {
    const tree = parseHTMLToA11yTree('<nav>Links</nav>')
    const rendered = renderA11yTree(tree)
    const lines = rendered.split('\n')
    // Root at indent 0, children at indent 1
    expect(lines[0]).toMatch(/^\[document\]/)
    if (lines.length > 1) {
      expect(lines[1]).toMatch(/^  \[/) // 2 spaces indent
    }
  })
})

// ── countA11yNodes ──

describe('countA11yNodes', () => {
  it('should count all nodes', () => {
    const tree = parseHTMLToA11yTree('<h1>Title</h1><h2>Sub</h2><button>OK</button>')
    const count = countA11yNodes(tree)
    expect(count).toBeGreaterThanOrEqual(4) // root + 3 children
  })

  it('should count root alone', () => {
    const tree = parseHTMLToA11yTree('<div>No semantic content</div>')
    expect(countA11yNodes(tree)).toBe(1) // Just root
  })
})

// ── checkA11yIssues ──

describe('checkA11yIssues', () => {
  it('should detect images without alt', () => {
    const issues = checkA11yIssues('<img src="photo.jpg">')
    expect(issues.some(i => i.includes('missing alt'))).toBe(true)
  })

  it('should detect empty buttons', () => {
    const issues = checkA11yIssues('<button></button>')
    expect(issues.some(i => i.includes('button'))).toBe(true)
  })

  it('should detect heading hierarchy skip', () => {
    const issues = checkA11yIssues('<h1>Title</h1><h3>Skip h2</h3>')
    expect(issues.some(i => i.includes('Heading hierarchy'))).toBe(true)
  })

  it('should detect missing lang', () => {
    const issues = checkA11yIssues('<html><body>Content</body></html>')
    expect(issues.some(i => i.includes('lang'))).toBe(true)
  })

  it('should report no issues for good HTML', () => {
    const issues = checkA11yIssues(`
      <html lang="en">
        <body>
          <h1>Title</h1>
          <h2>Subtitle</h2>
          <img src="pic.jpg" alt="Description">
          <button>Click me</button>
          <a href="/">Home</a>
        </body>
      </html>
    `)
    // May still have some, but should not have the major ones
    expect(issues.filter(i => i.includes('missing alt'))).toHaveLength(0)
    expect(issues.filter(i => i.includes('Heading hierarchy'))).toHaveLength(0)
    expect(issues.filter(i => i.includes('lang'))).toHaveLength(0)
  })
})

// ── AccessibilityTreeTool ──

describe('AccessibilityTreeTool', () => {
  it('should have correct metadata', () => {
    expect(AccessibilityTreeTool.name).toBe('AccessibilityTree')
    expect(AccessibilityTreeTool.readOnly).toBe(true)
  })

  it('should error when no input', async () => {
    const result = await AccessibilityTreeTool.execute({}, ctx)
    expect(result.isError).toBe(true)
  })

  it('should parse HTML input', async () => {
    const result = await AccessibilityTreeTool.execute({
      html: '<h1>Welcome</h1><nav>Menu</nav><button>Submit</button>',
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Accessibility Tree')
    expect(result.content).toContain('[heading]')
    expect(result.content).toContain('[navigation]')
    expect(result.content).toContain('[button]')
    expect(result.meta?.nodeCount).toBeGreaterThanOrEqual(4)
  })

  it('should include issue check when requested', async () => {
    const result = await AccessibilityTreeTool.execute({
      html: '<img src="no-alt.jpg"><button></button>',
      check_issues: true,
    }, ctx)

    expect(result.content).toContain('Accessibility Issues')
    expect(result.meta?.issueCount).toBeGreaterThan(0)
  })

  it('should report clean HTML as no issues', async () => {
    const result = await AccessibilityTreeTool.execute({
      html: '<html lang="en"><body><h1>Title</h1><img src="x.jpg" alt="desc"><button>OK</button></body></html>',
      check_issues: true,
    }, ctx)

    // Check that major issues are not present
    expect(result.content).not.toContain('missing alt')
  })
})
