/**
 * Wave 5 Task Queue + Workspace 测试
 * #7.10 + #7.11
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TaskQueue, WorkspaceManager, analyzeWorkspace, discoverProjects } from '../task-queue'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-taskq-test-' + Date.now())

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ── Task Queue ──

describe('TaskQueue', () => {
  it('should add tasks', () => {
    const q = new TaskQueue()
    q.add('task1', async () => 'result1')
    q.add('task2', async () => 'result2')
    expect(q.size).toBe(2)
    expect(q.pendingCount).toBe(2)
  })

  it('should execute tasks', async () => {
    const q = new TaskQueue()
    const id = q.add('test', async () => 42)
    await q.start()

    const task = q.getTask(id)
    expect(task?.status).toBe('completed')
    expect(task?.result).toBe(42)
  })

  it('should execute in priority order', async () => {
    const order: string[] = []
    const q = new TaskQueue(1)

    q.add('low', async () => { order.push('low') }, { priority: 1 })
    q.add('high', async () => { order.push('high') }, { priority: 10 })
    q.add('mid', async () => { order.push('mid') }, { priority: 5 })

    await q.start()

    expect(order).toEqual(['high', 'mid', 'low'])
  })

  it('should handle task failure', async () => {
    const q = new TaskQueue()
    const id = q.add('fail', async () => { throw new Error('boom') })
    await q.start()

    const task = q.getTask(id)
    expect(task?.status).toBe('failed')
    expect(task?.error).toBe('boom')
  })

  it('should cancel pending task', async () => {
    const q = new TaskQueue()
    const id = q.add('cancel-me', async () => 'nope')
    expect(q.cancel(id)).toBe(true)

    const task = q.getTask(id)
    expect(task?.status).toBe('cancelled')
  })

  it('should not cancel non-pending task', async () => {
    const q = new TaskQueue()
    const id = q.add('done', async () => 'ok')
    await q.start()
    expect(q.cancel(id)).toBe(false)
  })

  it('should respect dependencies', async () => {
    const order: string[] = []
    const q = new TaskQueue(1)

    const id1 = q.add('first', async () => { order.push('first') })
    q.add('second', async () => { order.push('second') }, { dependsOn: [id1] })

    await q.start()

    expect(order).toEqual(['first', 'second'])
  })

  it('should get completed tasks', async () => {
    const q = new TaskQueue()
    q.add('a', async () => 1)
    q.add('b', async () => 2)
    await q.start()
    expect(q.getCompleted()).toHaveLength(2)
  })

  it('should reset', () => {
    const q = new TaskQueue()
    q.add('t', async () => 1)
    q.reset()
    expect(q.size).toBe(0)
  })
})

// ── Workspace Manager ──

describe('WorkspaceManager', () => {
  it('should add workspace', () => {
    const wm = new WorkspaceManager()
    const info = wm.add(TEST_DIR)
    expect(info.path).toBeTruthy()
    expect(wm.size).toBe(1)
  })

  it('should set first workspace as current', () => {
    const wm = new WorkspaceManager()
    wm.add(TEST_DIR)
    expect(wm.currentPath).toBe(wm.getCurrent()?.path)
  })

  it('should switch workspace', () => {
    const dir2 = join(TEST_DIR, 'project2')
    mkdirSync(dir2, { recursive: true })

    const wm = new WorkspaceManager()
    wm.add(TEST_DIR)
    wm.add(dir2)

    expect(wm.switchTo(dir2)).toBe(true)
    expect(wm.currentPath).toBe(dir2)
  })

  it('should fail to switch to unknown workspace', () => {
    const wm = new WorkspaceManager()
    expect(wm.switchTo('/nonexistent')).toBe(false)
  })

  it('should list workspaces', () => {
    const wm = new WorkspaceManager()
    wm.add(TEST_DIR)
    expect(wm.list()).toHaveLength(1)
  })

  it('should remove workspace', () => {
    const wm = new WorkspaceManager()
    wm.add(TEST_DIR)
    expect(wm.remove(TEST_DIR)).toBe(true)
    expect(wm.size).toBe(0)
  })
})

describe('analyzeWorkspace', () => {
  it('should detect git repo', () => {
    mkdirSync(join(TEST_DIR, '.git'), { recursive: true })
    const info = analyzeWorkspace(TEST_DIR)
    expect(info.hasGit).toBe(true)
  })

  it('should detect package.json', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), '{}')
    const info = analyzeWorkspace(TEST_DIR)
    expect(info.hasPackageJson).toBe(true)
  })

  it('should detect dsxu config', () => {
    mkdirSync(join(TEST_DIR, '.dsxu'), { recursive: true })
    const info = analyzeWorkspace(TEST_DIR)
    expect(info.hasConfig).toBe(true)
  })
})

describe('discoverProjects', () => {
  it('should find projects in subdirs', () => {
    const proj1 = join(TEST_DIR, 'proj1')
    const proj2 = join(TEST_DIR, 'proj2')
    mkdirSync(proj1, { recursive: true })
    mkdirSync(proj2, { recursive: true })
    writeFileSync(join(proj1, 'package.json'), '{}')
    writeFileSync(join(proj2, 'package.json'), '{}')

    const projects = discoverProjects(TEST_DIR)
    expect(projects).toHaveLength(2)
  })

  it('should skip node_modules', () => {
    const nm = join(TEST_DIR, 'node_modules', 'pkg')
    mkdirSync(nm, { recursive: true })
    writeFileSync(join(nm, 'package.json'), '{}')

    const projects = discoverProjects(TEST_DIR)
    expect(projects).toHaveLength(0)
  })
})
