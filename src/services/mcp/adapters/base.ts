/**
 * R5-32 MCP Server 适配器 — 基类 + 5 个 adapter
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface McpAdapterConfig {
  mockInvoke?: (toolName: string, args: any) => Promise<any>;
  mockHealthCheck?: () => Promise<boolean>;
}

export abstract class McpAdapter {
  abstract name: string;
  protected config?: McpAdapterConfig;

  constructor(config?: McpAdapterConfig) { this.config = config; }

  abstract listTools(): Promise<McpTool[]>;

  async invoke(toolName: string, args: any): Promise<any> {
    if (this.config?.mockInvoke) return this.config.mockInvoke(toolName, args);
    return this.realInvoke(toolName, args);
  }

  async healthCheck(): Promise<boolean> {
    if (this.config?.mockHealthCheck) return this.config.mockHealthCheck();
    return this.realHealthCheck();
  }

  protected abstract realInvoke(toolName: string, args: any): Promise<any>;
  protected abstract realHealthCheck(): Promise<boolean>;
}

export class FilesystemAdapter extends McpAdapter {
  name = 'filesystem';
  async listTools() {
    return [
      { name: 'read', description: 'Read file content', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
      { name: 'write', description: 'Write file content', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
      { name: 'glob', description: 'Find files by pattern', inputSchema: { type: 'object', properties: { pattern: { type: 'string' } } } },
      { name: 'search', description: 'Search in files', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
    ];
  }
  protected async realInvoke(toolName: string, args: any) { return { tool: toolName, status: 'not_implemented' }; }
  protected async realHealthCheck() { return true; }
}

export class GitAdapter extends McpAdapter {
  name = 'git';
  async listTools() {
    return [
      { name: 'log', description: 'Git log', inputSchema: { type: 'object', properties: { n: { type: 'number' } } } },
      { name: 'diff', description: 'Git diff', inputSchema: { type: 'object', properties: { ref: { type: 'string' } } } },
      { name: 'blame', description: 'Git blame', inputSchema: { type: 'object', properties: { file: { type: 'string' } } } },
      { name: 'show', description: 'Git show', inputSchema: { type: 'object', properties: { ref: { type: 'string' } } } },
    ];
  }
  protected async realInvoke(toolName: string, args: any) { return { tool: toolName, status: 'not_implemented' }; }
  protected async realHealthCheck() { return true; }
}

export class PostgresAdapter extends McpAdapter {
  name = 'postgres';
  async listTools() {
    return [
      { name: 'query', description: 'Execute SQL query', inputSchema: { type: 'object', properties: { sql: { type: 'string' } } } },
      { name: 'schema', description: 'Get table schema', inputSchema: { type: 'object', properties: { table: { type: 'string' } } } },
      { name: 'explain', description: 'Explain query plan', inputSchema: { type: 'object', properties: { sql: { type: 'string' } } } },
    ];
  }
  protected async realInvoke(toolName: string, args: any) { return { tool: toolName, status: 'not_implemented' }; }
  protected async realHealthCheck() { return !!process.env.DSXU_MCP_POSTGRES_TOKEN; }
}

export class SlackAdapter extends McpAdapter {
  name = 'slack';
  async listTools() {
    return [
      { name: 'send', description: 'Send message', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, text: { type: 'string' } } } },
      { name: 'read_channel', description: 'Read channel messages', inputSchema: { type: 'object', properties: { channel: { type: 'string' } } } },
      { name: 'search', description: 'Search messages', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
    ];
  }
  protected async realInvoke(toolName: string, args: any) { return { tool: toolName, status: 'not_implemented' }; }
  protected async realHealthCheck() { return !!process.env.DSXU_MCP_SLACK_TOKEN; }
}

export class GithubAdapter extends McpAdapter {
  name = 'github';
  async listTools() {
    return [
      { name: 'issues', description: 'List/get issues', inputSchema: { type: 'object', properties: { repo: { type: 'string' } } } },
      { name: 'prs', description: 'List/get PRs', inputSchema: { type: 'object', properties: { repo: { type: 'string' } } } },
      { name: 'actions', description: 'List CI runs', inputSchema: { type: 'object', properties: { repo: { type: 'string' } } } },
    ];
  }
  protected async realInvoke(toolName: string, args: any) { return { tool: toolName, status: 'not_implemented' }; }
  protected async realHealthCheck() { return !!process.env.DSXU_MCP_GITHUB_TOKEN; }
}

/** 创建所有 adapter */
export function createAllAdapters(config?: McpAdapterConfig): McpAdapter[] {
  return [
    new FilesystemAdapter(config),
    new GitAdapter(config),
    new PostgresAdapter(config),
    new SlackAdapter(config),
    new GithubAdapter(config),
  ];
}
