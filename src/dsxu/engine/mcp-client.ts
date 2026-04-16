/**
 * #22 MCP Client — Model Context Protocol 轻量客户端
 *
 * 连接外部 MCP server，将其工具暴露为 DSxu ToolDefinition。
 *
 * 支持的传输方式：
 *   1. stdio — 子进程（最常用，如 mcp-server-filesystem）
 *   2. sse   — HTTP Server-Sent Events
 *
 * MCP 协议核心流程：
 *   initialize → tools/list → [callTool] → shutdown
 *
 * 与 Claude 的区别：
 *   - Claude: React context + 7 种传输 + OAuth + 企业配置
 *   - DSxu V13: 纯 TS + stdio/sse + .mcp.json 配置（够用）
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { spawn, type ChildProcess } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── MCP Types ──

export interface MCPServerConfig {
  /** 服务器名称 */
  name: string
  /** 传输类型 */
  transport: 'stdio' | 'sse' | 'http'
  /** stdio: 命令 */
  command?: string
  /** stdio: 参数 */
  args?: string[]
  /** stdio: 环境变量 */
  env?: Record<string, string>
  /** sse: URL */
  url?: string
  /** 是否启用 */
  enabled?: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface MCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface MCPResourceTemplate {
  uriTemplate: string
  name?: string
  description?: string
  mimeType?: string
}

interface MCPRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: any
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: number
  result?: any
  error?: { code: number; message: string }
}

// ── MCP Connection (stdio) ──

export class MCPConnection {
  private process: ChildProcess | null = null
  private requestId = 0
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void
    reject: (error: Error) => void
  }>()
  private buffer = ''
  private serverName: string
  private tools: MCPTool[] = []
  private resources: MCPResource[] = []
  private resourceTemplates: MCPResourceTemplate[] = []
  private connected = false
  private remoteUrl: string | null = null
  private closed = false

  constructor(private config: MCPServerConfig) {
    this.serverName = config.name
  }

  /** 连接并初始化 */
  async connect(): Promise<void> {
    if (this.config.transport === 'stdio') {
      await this.connectStdio()
    } else if (this.config.transport === 'sse' || this.config.transport === 'http') {
      await this.connectRemote()
    }

    // MCP initialize handshake
    const initResult = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'dsxu', version: '1.0' },
    })

    // Send initialized notification
    this.notify('notifications/initialized', {})

    // Fetch tools
    const toolsResult = await this.request('tools/list', {})
    this.tools = (toolsResult?.tools ?? []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || { type: 'object' },
    }))

    // resources/list is optional in MCP; ignore if server does not implement it.
    try {
      const resourcesResult = await this.request('resources/list', {})
      this.resources = (resourcesResult?.resources ?? []).map((r: any) => ({
        uri: String(r.uri ?? ''),
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })).filter((r: MCPResource) => r.uri.length > 0)
    } catch {
      this.resources = []
    }

    // resources/templates/list is optional in MCP; ignore if not implemented.
    try {
      const templatesResult = await this.request('resources/templates/list', {})
      this.resourceTemplates = (templatesResult?.resourceTemplates ?? templatesResult?.templates ?? []).map((t: any) => ({
        uriTemplate: String(t.uriTemplate ?? ''),
        name: t.name,
        description: t.description,
        mimeType: t.mimeType,
      })).filter((t: MCPResourceTemplate) => t.uriTemplate.length > 0)
    } catch {
      this.resourceTemplates = []
    }

    this.connected = true
    console.log(`[MCP:${this.serverName}] Connected, ${this.tools.length} tools available`)
  }

  private async connectRemote(): Promise<void> {
    if (!this.config.url) {
      throw new Error(`MCP ${this.serverName}: url is required for ${this.config.transport} transport`)
    }
    this.remoteUrl = this.config.url
  }

  private async connectStdio(): Promise<void> {
    const { command, args = [], env } = this.config
    if (!command) throw new Error(`MCP ${this.serverName}: command is required for stdio transport`)

    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    this.closed = false

    this.process.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      this.processBuffer()
    })

    this.process.stderr!.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.warn(`[MCP:${this.serverName}] stderr: ${msg}`)
    })

    this.process.on('exit', (code) => {
      this.closed = true
      this.connected = false
      this.failPendingRequests(new Error(
        `MCP ${this.serverName}: process exited${code !== null ? ` with code ${code}` : ''}`
      ))
      if (code !== 0) {
        console.warn(`[MCP:${this.serverName}] Process exited with code ${code}`)
      }
    })

    this.process.on('close', (code) => {
      this.closed = true
      this.connected = false
      this.failPendingRequests(new Error(
        `MCP ${this.serverName}: process closed${code !== null ? ` with code ${code}` : ''}`
      ))
    })

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP connect timeout')), 10_000)
      this.process!.on('spawn', () => { clearTimeout(timeout); resolve() })
      this.process!.on('error', (e) => {
        this.closed = true
        this.connected = false
        this.failPendingRequests(new Error(`MCP ${this.serverName}: process error: ${e.message}`))
        clearTimeout(timeout)
        reject(e)
      })
    })
  }

  private failPendingRequests(error: Error): void {
    if (this.pendingRequests.size === 0) return
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  /** 处理 JSON-RPC 缓冲区 */
  private processBuffer(): void {
    while (true) {
      const parsedFrame = this.tryReadContentLengthFrame()
      if (parsedFrame !== null) {
        this.consumeMessage(parsedFrame)
        continue
      }

      const nlIndex = this.buffer.indexOf('\n')
      if (nlIndex === -1) break

      const line = this.buffer.slice(0, nlIndex).trim()
      this.buffer = this.buffer.slice(nlIndex + 1)
      if (!line || line.startsWith('Content-Length:')) continue
      this.consumeMessage(line)
    }
  }

  private tryReadContentLengthFrame(): string | null {
    const headerStart = this.buffer.indexOf('Content-Length:')
    if (headerStart !== 0) return null

    const headerEnd = this.buffer.indexOf('\r\n\r\n')
    const altHeaderEnd = this.buffer.indexOf('\n\n')
    const boundary = headerEnd !== -1 ? headerEnd : altHeaderEnd
    if (boundary === -1) return null

    const headers = this.buffer.slice(0, boundary)
    const match = headers.match(/Content-Length:\s*(\d+)/i)
    if (!match) {
      this.buffer = this.buffer.slice(boundary + (headerEnd !== -1 ? 4 : 2))
      return null
    }

    const length = Number(match[1])
    const bodyStart = boundary + (headerEnd !== -1 ? 4 : 2)
    const remaining = this.buffer.slice(bodyStart)
    if (remaining.length < length) return null

    const payload = remaining.slice(0, length)
    this.buffer = remaining.slice(length)
    return payload
  }

  private consumeMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as MCPResponse
      if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id)!
        this.pendingRequests.delete(msg.id)
        if (msg.error) {
          pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`))
        } else {
          pending.resolve(msg.result)
        }
      }
    } catch {
      // Ignore malformed payload fragments.
    }
  }

  /** 发送 JSON-RPC 请求 */
  private request(method: string, params: any): Promise<any> {
    if (this.config.transport === 'sse' || this.config.transport === 'http') {
      return this.requestRemote(method, params)
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      const msg: MCPRequest = { jsonrpc: '2.0', id, method, params }

      this.pendingRequests.set(id, { resolve, reject })

      const json = JSON.stringify(msg)
      const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`

      if (!this.process?.stdin?.writable) {
        reject(new Error(`MCP ${this.serverName}: process not writable`))
        this.pendingRequests.delete(id)
        return
      }

      if (this.closed) {
        reject(new Error(`MCP ${this.serverName}: process already closed`))
        this.pendingRequests.delete(id)
        return
      }

      this.process.stdin.write(data)

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP ${this.serverName}: request timeout for ${method}`))
        }
      }, 30_000)
    })
  }

  private async requestRemote(method: string, params: any): Promise<any> {
    if (!this.remoteUrl) {
      throw new Error(`MCP ${this.serverName}: remote url is not configured`)
    }

    const id = ++this.requestId
    const msg: MCPRequest = { jsonrpc: '2.0', id, method, params }

    const resp = await fetch(this.remoteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
      signal: AbortSignal.timeout(30_000),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      throw new Error(
        `MCP ${this.serverName}: HTTP ${resp.status}${errText ? `: ${errText}` : ''}`
      )
    }

    const payload = await resp.json() as MCPResponse | { result?: any; error?: any }
    if ((payload as MCPResponse).error) {
      const e = (payload as MCPResponse).error!
      throw new Error(`MCP error ${e.code}: ${e.message}`)
    }

    return (payload as MCPResponse).result ?? (payload as any).result ?? payload
  }

  /** 发送通知（无需响应） */
  private notify(method: string, params: any): void {
    if (this.config.transport === 'sse' || this.config.transport === 'http') {
      if (!this.remoteUrl) return
      const msg = { jsonrpc: '2.0', method, params }
      void fetch(this.remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {})
      return
    }

    const msg = { jsonrpc: '2.0', method, params }
    const json = JSON.stringify(msg)
    const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`
    this.process?.stdin?.write(data)
  }

  /** 调用 MCP 工具 */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    if (!this.connected) throw new Error(`MCP ${this.serverName}: not connected`)

    const result = await this.request('tools/call', {
      name,
      arguments: args,
    })

    return result
  }

  /** 获取工具列表 */
  getTools(): MCPTool[] {
    return [...this.tools]
  }

  /** 获取资源列表（连接时缓存） */
  getResources(): MCPResource[] {
    return [...this.resources]
  }

  /** 获取资源模板列表（连接时缓存） */
  getResourceTemplates(): MCPResourceTemplate[] {
    return [...this.resourceTemplates]
  }

  /** 主动刷新资源列表 */
  async listResources(): Promise<MCPResource[]> {
    if (!this.connected) throw new Error(`MCP ${this.serverName}: not connected`)
    const resourcesResult = await this.request('resources/list', {})
    this.resources = (resourcesResult?.resources ?? []).map((r: any) => ({
      uri: String(r.uri ?? ''),
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })).filter((r: MCPResource) => r.uri.length > 0)
    return [...this.resources]
  }

  /** 主动刷新资源模板列表 */
  async listResourceTemplates(): Promise<MCPResourceTemplate[]> {
    if (!this.connected) throw new Error(`MCP ${this.serverName}: not connected`)
    const templatesResult = await this.request('resources/templates/list', {})
    this.resourceTemplates = (templatesResult?.resourceTemplates ?? templatesResult?.templates ?? []).map((t: any) => ({
      uriTemplate: String(t.uriTemplate ?? ''),
      name: t.name,
      description: t.description,
      mimeType: t.mimeType,
    })).filter((t: MCPResourceTemplate) => t.uriTemplate.length > 0)
    return [...this.resourceTemplates]
  }

  /** 读取单个资源 */
  async readResource(uri: string): Promise<any> {
    if (!this.connected) throw new Error(`MCP ${this.serverName}: not connected`)
    return await this.request('resources/read', { uri })
  }

  /** 读取资源模板（优先 resources/templates/read，失败回退 resources/read） */
  async readResourceTemplate(uriTemplate: string, args?: Record<string, any>): Promise<any> {
    if (!this.connected) throw new Error(`MCP ${this.serverName}: not connected`)

    try {
      return await this.request('resources/templates/read', { uriTemplate, arguments: args ?? {} })
    } catch {
      return await this.request('resources/read', { uri: uriTemplate, arguments: args ?? {} })
    }
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.connected
  }

  /** 关闭连接 */
  async disconnect(): Promise<void> {
    if (this.process) {
      try {
        await this.request('shutdown', {})
        this.notify('exit', {})
      } catch {}

      this.process.kill()
      this.process = null
    } else if ((this.config.transport === 'sse' || this.config.transport === 'http') && this.remoteUrl) {
      try {
        await this.request('shutdown', {})
      } catch {}
    }
    this.connected = false
    this.pendingRequests.clear()
    console.log(`[MCP:${this.serverName}] Disconnected`)
  }
}

// ── MCP Manager ──

export class MCPManager {
  private connections = new Map<string, MCPConnection>()

  /** 从配置连接所有 MCP server */
  async connectAll(configs: MCPServerConfig[]): Promise<void> {
    const enabled = configs.filter(c => c.enabled !== false)
    const enabledSorted = [...enabled].sort((a, b) => a.name.localeCompare(b.name))
    const targetNames = new Set(enabledSorted.map(c => c.name))

    for (const [name, conn] of this.connections.entries()) {
      if (!targetNames.has(name)) {
        await conn.disconnect().catch(() => {})
        this.connections.delete(name)
      }
    }

    await Promise.allSettled(
      enabledSorted.map(async (config) => {
        try {
          const previous = this.connections.get(config.name)
          if (previous) {
            await previous.disconnect().catch(() => {})
          }
          const conn = new MCPConnection(config)
          await conn.connect()
          this.connections.set(config.name, conn)
        } catch (error: any) {
          console.warn(`[MCP] Failed to connect ${config.name}: ${error.message}`)
        }
      })
    )

    console.log(`[MCP] Connected ${this.connections.size}/${enabledSorted.length} servers`)
  }

  /** 从 .mcp.json 加载配置并连接 */
  async connectFromConfig(cwd: string): Promise<void> {
    const configPath = join(cwd, '.mcp.json')
    if (!existsSync(configPath)) {
      console.log('[MCP] No .mcp.json found, skipping MCP initialization')
      return
    }

    try {
      const raw = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)
      const serversByName = new Map<string, MCPServerConfig>()
      const localEnvScope = {
        ...(config?.env && typeof config.env === 'object' ? config.env : {}),
        ...(config?.variables && typeof config.variables === 'object' ? config.variables : {}),
      } as Record<string, unknown>

      // 支持对象格式:
      // { mcpServers: { name: { command, args, env } } }
      // { servers: { name: { ... } } }
      // 以及数组格式:
      // { mcpServers: [{ name, ... }] } / { servers: [{ name, ... }] }
      const mcpServers = config.mcpServers || config.servers || {}
      if (Array.isArray(mcpServers)) {
        for (const item of mcpServers) {
          if (!item || typeof item !== 'object') continue
          const name = String(item.name ?? '').trim()
          if (!name) continue
          serversByName.set(name, {
            name,
            transport: normalizeTransport(item.transport || item.type),
            command: interpolateEnvValue(String(item.command ?? ''), localEnvScope) || undefined,
            args: Array.isArray(item.args)
              ? item.args.map((arg: unknown) => interpolateEnvValue(String(arg ?? ''), localEnvScope))
              : undefined,
            env: resolveEnvMap(item.env, localEnvScope),
            url: item.url ? interpolateEnvValue(String(item.url), localEnvScope) : undefined,
            enabled: item.enabled ?? true,
          })
        }
      } else {
        for (const [name, serverConf] of Object.entries(mcpServers) as any[]) {
          serversByName.set(name, {
            name,
            transport: normalizeTransport(serverConf.transport || serverConf.type),
            command: interpolateEnvValue(String(serverConf.command ?? ''), localEnvScope) || undefined,
            args: Array.isArray(serverConf.args)
              ? serverConf.args.map((arg: unknown) => interpolateEnvValue(String(arg ?? ''), localEnvScope))
              : undefined,
            env: resolveEnvMap(serverConf.env, localEnvScope),
            url: serverConf.url ? interpolateEnvValue(String(serverConf.url), localEnvScope) : undefined,
            enabled: serverConf.enabled ?? true,
          })
        }
      }
      const servers = Array.from(serversByName.values())

      if (servers.length > 0) {
        await this.connectAll(servers)
      }
    } catch (error: any) {
      console.warn(`[MCP] Config parse error: ${error.message}`)
    }
  }

  /**
   * 将所有 MCP 工具转换为 DSxu ToolDefinition[]
   *
   * 工具名格式: mcp__{serverName}__{toolName}
   */
  getToolDefinitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = []

    for (const [serverName, conn] of this.connections) {
      if (!conn.isConnected()) continue

      for (const mcpTool of conn.getTools()) {
        const qualifiedName = `mcp__${serverName}__${mcpTool.name}`

        tools.push({
          name: qualifiedName,
          description: `[MCP:${serverName}] ${mcpTool.description}`,
          inputSchema: mcpTool.inputSchema,
          concurrencySafe: true,  // MCP tools 默认允许并发
          readOnly: false,        // 无法确定，保守标记
          execute: async (input: Record<string, any>): Promise<ToolOutput> => {
            try {
              const result = await conn.callTool(mcpTool.name, input)

              // MCP result 格式: { content: [{ type: 'text', text: '...' }], isError?: boolean }
              let content = ''
              if (result?.content) {
                if (Array.isArray(result.content)) {
                  content = result.content
                    .map((c: any) => c.text || c.data || JSON.stringify(c))
                    .join('\n')
                } else {
                  content = String(result.content)
                }
              } else {
                content = JSON.stringify(result)
              }

              return {
                content: content.slice(0, 30_000),
                isError: result?.isError === true,
              }
            } catch (error: any) {
              return {
                content: `MCP tool error (${serverName}/${mcpTool.name}): ${error.message}`,
                isError: true,
              }
            }
          },
        })
      }

      tools.push({
        name: `mcp__${serverName}__list_resources`,
        description: `[MCP:${serverName}] List available MCP resources`,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        concurrencySafe: true,
        readOnly: true,
        execute: async (): Promise<ToolOutput> => {
          try {
            const resources = await conn.listResources()
            return {
              content: JSON.stringify({ resources }, null, 2).slice(0, 30_000),
              isError: false,
            }
          } catch (error: any) {
            return {
              content: `MCP resource list error (${serverName}): ${error.message}`,
              isError: true,
            }
          }
        },
      })

      tools.push({
        name: `mcp__${serverName}__read_resource`,
        description: `[MCP:${serverName}] Read MCP resource by URI`,
        inputSchema: {
          type: 'object',
          properties: { uri: { type: 'string' } },
          required: ['uri'],
          additionalProperties: false,
        },
        concurrencySafe: true,
        readOnly: true,
        execute: async (input: Record<string, any>): Promise<ToolOutput> => {
          try {
            const uri = String(input?.uri ?? '').trim()
            if (!uri) {
              return { content: 'Missing required field: uri', isError: true }
            }

            const result = await conn.readResource(uri)
            let content = ''
            if (result?.contents && Array.isArray(result.contents)) {
              content = result.contents
                .map((c: any) => c.text || c.data || JSON.stringify(c))
                .join('\n')
            } else {
              content = JSON.stringify(result, null, 2)
            }

            return { content: content.slice(0, 30_000), isError: false }
          } catch (error: any) {
            return {
              content: `MCP read resource error (${serverName}): ${error.message}`,
              isError: true,
            }
          }
        },
      })

      tools.push({
        name: `mcp__${serverName}__list_resource_templates`,
        description: `[MCP:${serverName}] List available MCP resource templates`,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        concurrencySafe: true,
        readOnly: true,
        execute: async (): Promise<ToolOutput> => {
          try {
            const templates = await conn.listResourceTemplates()
            return {
              content: JSON.stringify({ templates }, null, 2).slice(0, 30_000),
              isError: false,
            }
          } catch (error: any) {
            return {
              content: `MCP resource template list error (${serverName}): ${error.message}`,
              isError: true,
            }
          }
        },
      })

      tools.push({
        name: `mcp__${serverName}__read_resource_template`,
        description: `[MCP:${serverName}] Read MCP resource template by uriTemplate with arguments`,
        inputSchema: {
          type: 'object',
          properties: {
            uriTemplate: { type: 'string' },
            arguments: { type: 'object', additionalProperties: true },
          },
          required: ['uriTemplate'],
          additionalProperties: false,
        },
        concurrencySafe: true,
        readOnly: true,
        execute: async (input: Record<string, any>): Promise<ToolOutput> => {
          try {
            const uriTemplate = String(input?.uriTemplate ?? '').trim()
            if (!uriTemplate) {
              return { content: 'Missing required field: uriTemplate', isError: true }
            }

            const result = await conn.readResourceTemplate(
              uriTemplate,
              typeof input?.arguments === 'object' && input.arguments !== null
                ? input.arguments
                : {},
            )

            let content = ''
            if (result?.contents && Array.isArray(result.contents)) {
              content = result.contents
                .map((c: any) => c.text || c.data || JSON.stringify(c))
                .join('\n')
            } else {
              content = JSON.stringify(result, null, 2)
            }

            return { content: content.slice(0, 30_000), isError: false }
          } catch (error: any) {
            return {
              content: `MCP read resource template error (${serverName}): ${error.message}`,
              isError: true,
            }
          }
        },
      })
    }

    return tools
  }

  /** 获取连接状态 */
  getStatus(): Array<{ name: string; connected: boolean; toolCount: number; resourceCount: number; resourceTemplateCount: number }> {
    return Array.from(this.connections.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, conn]) => ({
      name,
      connected: conn.isConnected(),
      toolCount: conn.getTools().length,
      resourceCount: conn.getResources().length,
      resourceTemplateCount: conn.getResourceTemplates().length,
    }))
  }

  /** 断开所有连接 */
  async disconnectAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.connections.values()).map(c => c.disconnect())
    )
    this.connections.clear()
  }

  /** 获取连接数 */
  get size(): number {
    return this.connections.size
  }
}

function resolveEnvMap(env: unknown, localEnvScope?: Record<string, unknown>): Record<string, string> | undefined {
  if (!env || typeof env !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    out[k] = interpolateEnvValue(String(v ?? ''), localEnvScope)
  }
  return out
}

function interpolateEnvValue(input: string, localEnvScope?: Record<string, unknown>): string {
  return input.replace(/\$\{([A-Z0-9_]+)(:-([^}]*))?\}/gi, (_m, name: string, _fallbackExpr: string, fallback: string) => {
    const localValue = localEnvScope?.[name]
    if (localValue !== undefined && String(localValue) !== '') return String(localValue)
    const value = process.env[name]
    if (value !== undefined && value !== '') return value
    return fallback ?? ''
  })
}

function normalizeTransport(transport: unknown): MCPServerConfig['transport'] {
  const raw = String(transport ?? 'stdio').trim().toLowerCase()
  if (raw === 'http' || raw === 'streamable_http' || raw === 'streamable-http') return 'http'
  if (raw === 'sse') return 'sse'
  return 'stdio'
}
