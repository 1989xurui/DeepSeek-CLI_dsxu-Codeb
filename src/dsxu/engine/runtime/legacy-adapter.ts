/**
 * DUXU Runtime Core - 旧版SessionStore适配器
 *
 * 将旧的SessionStore接口适配到新的Runtime Core
 */

import type { SessionStore as LegacySessionStore, SessionData, SessionMeta } from '../session-state'
import type { PersistAdapter } from './persist/adapter'
import type { Session } from './session/model'
import { createSession, updateSession } from './session/model'

/**
 * 旧版SessionStore适配器
 *
 * 实现旧版SessionStore接口，但使用新的Runtime Core作为后端
 */
export class LegacySessionStoreAdapter implements LegacySessionStore {
  private persist: PersistAdapter
  private baseDir: string

  constructor(persist: PersistAdapter, baseDir?: string) {
    this.persist = persist
    this.baseDir = baseDir || getDefaultSessionDir()
  }

  /**
   * 创建新会话（旧版接口）
   */
  create(cwd: string, title?: string): SessionData {
    // 使用新的Runtime Core创建会话
    const session = createSession({
      cwd,
      title: title || `Session ${new Date().toLocaleString()}`
    })

    // 转换为旧版格式
    const legacySession = this.convertToLegacy(session)

    // 保存到新的持久化层
    this.persist.saveSession(session).catch(error => {
      console.error('保存会话失败', error)
    })

    return legacySession
  }

  /**
   * 保存会话（旧版接口）
   */
  save(session: SessionData): void {
    // 转换为新的Session格式
    const newSession = this.convertFromLegacy(session)

    // 保存到新的持久化层
    this.persist.saveSession(newSession).catch(error => {
      console.error('保存会话失败', error)
    })
  }

  /**
   * 追加消息（旧版接口）
   */
  appendMessage(sessionId: string, message: any): void {
    // 加载会话
    this.persist.loadSession(sessionId).then(session => {
      if (!session) return

      // 更新会话（这里简化处理，实际需要处理消息）
      const updatedSession = updateSession(session, {
        metadata: {
          ...session.metadata,
          lastMessage: message,
          messageCount: (session.metadata.messageCount || 0) + 1
        }
      })

      // 保存更新
      return this.persist.saveSession(updatedSession)
    }).catch(error => {
      console.error('追加消息失败', error)
    })
  }

  /**
   * 加载会话（旧版接口）
   */
  load(sessionId: string): SessionData | null {
    // 同步加载不支持，返回null
    console.warn('LegacySessionStoreAdapter.load() 不支持同步加载，请使用异步版本')
    return null
  }

  /**
   * 异步加载会话
   */
  async loadAsync(sessionId: string): Promise<SessionData | null> {
    const session = await this.persist.loadSession(sessionId)
    return session ? this.convertToLegacy(session) : null
  }

  /**
   * 列出所有会话（旧版接口）
   */
  listAll(): SessionData[] {
    // 同步列出不支持，返回空数组
    console.warn('LegacySessionStoreAdapter.listAll() 不支持同步列出，请使用异步版本')
    return []
  }

  /**
   * 异步列出所有会话
   */
  async listAllAsync(): Promise<SessionData[]> {
    const sessions = await this.persist.listSessions()
    return sessions.map(session => this.convertToLegacy(session))
  }

  /**
   * 删除会话（旧版接口）
   */
  delete(sessionId: string): boolean {
    this.persist.deleteSession(sessionId).catch(error => {
      console.error('删除会话失败', error)
    })
    return true // 假设成功
  }

  /**
   * 获取会话文件路径（旧版接口）
   */
  getSessionPath(sessionId: string): string {
    // 返回模拟路径
    return `${this.baseDir}/${sessionId}.json`
  }

  /**
   * 将新的Session转换为旧版SessionData
   */
  private convertToLegacy(session: Session): SessionData {
    const meta: SessionMeta = {
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cwd: session.cwd,
      title: session.title,
      messageCount: session.metadata.messageCount || 0,
      status: this.convertStatus(session.status),
      totalCost: session.metadata.totalCost,
      models: session.metadata.models,
      summary: session.metadata.summary,
      summaryUpdatedAt: session.metadata.summaryUpdatedAt,
      summaryVersion: session.metadata.summaryVersion
    }

    return {
      meta,
      messages: session.metadata.messages || []
    }
  }

  /**
   * 将旧版SessionData转换为新的Session
   */
  private convertFromLegacy(sessionData: SessionData): Session {
    const session = createSession({
      cwd: sessionData.meta.cwd,
      title: sessionData.meta.title
    })

    // 更新为加载的会话数据
    return updateSession(session, {
      id: sessionData.meta.id,
      createdAt: sessionData.meta.createdAt,
      updatedAt: sessionData.meta.updatedAt,
      status: this.convertStatusBack(sessionData.meta.status),
      metadata: {
        messageCount: sessionData.meta.messageCount,
        totalCost: sessionData.meta.totalCost,
        models: sessionData.meta.models,
        summary: sessionData.meta.summary,
        summaryUpdatedAt: sessionData.meta.summaryUpdatedAt,
        summaryVersion: sessionData.meta.summaryVersion,
        messages: sessionData.messages
      }
    })
  }

  /**
   * 转换状态从新到旧
   */
  private convertStatus(status: string): 'active' | 'completed' | 'aborted' {
    switch (status) {
      case 'active':
      case 'running':
        return 'active'
      case 'completed':
      case 'success':
        return 'completed'
      default:
        return 'aborted'
    }
  }

  /**
   * 转换状态从旧到新
   */
  private convertStatusBack(status: 'active' | 'completed' | 'aborted'): string {
    switch (status) {
      case 'active':
        return 'active'
      case 'completed':
        return 'completed'
      case 'aborted':
        return 'aborted'
      default:
        return 'created'
    }
  }
}

/**
 * 获取默认会话目录
 */
function getDefaultSessionDir(): string {
  return '.dsxu/sessions'
}

/**
 * 创建旧版SessionStore适配器
 */
export function createLegacySessionStoreAdapter(
  persist: PersistAdapter,
  baseDir?: string
): LegacySessionStore {
  return new LegacySessionStoreAdapter(persist, baseDir)
}
// Legacy adapter copied to
// src/dsxu/_deleted_files/legacy-freeze/legacy-adapter.ts.
// It must not be imported by DSXU mainline code.
