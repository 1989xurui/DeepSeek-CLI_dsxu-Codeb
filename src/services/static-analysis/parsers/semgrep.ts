/**
 * semgrep 输出解析器
 * 解析 semgrep --config p/security --json 的输出
 */

import { StaticIssue } from '../runner';

interface SemgrepMatch {
  check_id: string;
  path: string;
  start: {
    line: number;
    col: number;
  };
  end: {
    line: number;
    col: number;
  };
  extra: {
    message: string;
    metadata?: {
      category?: string;
      confidence?: string;
      impact?: string;
      likelihood?: string;
      owasp?: string[];
      cwe?: string[];
      references?: string[];
    };
    severity: 'ERROR' | 'WARNING' | 'INFO';
    lines?: string;
  };
}

interface SemgrepResult {
  results: SemgrepMatch[];
  errors: Array<{
    message: string;
    code: number;
    path?: string;
  }>;
  paths: {
    scanned: string[];
  };
  version?: string;
}

/**
 * 解析 semgrep JSON 输出
 */
export function parseSemgrepOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];

  try {
    const result: SemgrepResult = JSON.parse(output);

    // 处理扫描结果
    for (const match of result.results) {
      // 转换 severity
      let severity: 'error' | 'warning' | 'info' = 'info';
      if (match.extra.severity === 'ERROR') severity = 'error';
      else if (match.extra.severity === 'WARNING') severity = 'warning';

      // 构建消息
      let message = match.extra.message;

      // 添加元数据信息
      const metadata = match.extra.metadata;
      if (metadata) {
        const metadataParts: string[] = [];

        if (metadata.category) {
          metadataParts.push(`类别: ${metadata.category}`);
        }

        if (metadata.owasp && metadata.owasp.length > 0) {
          metadataParts.push(`OWASP: ${metadata.owasp.join(', ')}`);
        }

        if (metadata.cwe && metadata.cwe.length > 0) {
          metadataParts.push(`CWE: ${metadata.cwe.join(', ')}`);
        }

        if (metadata.confidence) {
          metadataParts.push(`置信度: ${metadata.confidence}`);
        }

        if (metadata.impact) {
          metadataParts.push(`影响: ${metadata.impact}`);
        }

        if (metadata.likelihood) {
          metadataParts.push(`可能性: ${metadata.likelihood}`);
        }

        if (metadataParts.length > 0) {
          message += ` (${metadataParts.join('; ')})`;
        }
      }

      issues.push({
        tool: 'semgrep',
        severity,
        file: normalizePath(match.path, cwd),
        line: match.start.line,
        col: match.start.col,
        ruleId: match.check_id,
        message,
      });
    }

    // 处理错误
    if (result.errors && result.errors.length > 0) {
      console.warn('[static-analysis] semgrep 扫描错误:', result.errors);

      // 将严重错误也作为问题报告
      for (const error of result.errors) {
        if (error.code >= 400) { // 客户端错误或服务器错误
          issues.push({
            tool: 'semgrep',
            severity: 'error',
            file: error.path ? normalizePath(error.path, cwd) : 'unknown',
            line: 0,
            col: 0,
            ruleId: `SEMGREP_ERROR_${error.code}`,
            message: `semgrep 扫描错误: ${error.message}`,
          });
        }
      }
    }

  } catch (error) {
    console.error('[static-analysis] 解析 semgrep 输出失败:', error);

    // 如果输出不是 JSON，尝试解析文本
    if (output.includes('Found') || output.includes('rule')) {
      return parseSemgrepTextOutput(output, cwd);
    }
  }

  return issues;
}

/**
 * 解析 semgrep 文本输出（fallback）
 */
function parseSemgrepTextOutput(output: string, cwd: string): StaticIssue[] {
  const issues: StaticIssue[] = [];
  const lines = output.split('\n');

  // semgrep 文本格式示例: /path/to/file.js:10: rule-id: message
  const semgrepPattern = /^(.+?):(\d+):\s+(.+?):\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 跳过摘要行
    if (trimmed.startsWith('Ran') || trimmed.startsWith('Total') || trimmed.includes('rules')) {
      continue;
    }

    const match = trimmed.match(semgrepPattern);
    if (match) {
      const [, file, lineStr, ruleId, message] = match;

      // 根据规则ID判断严重性
      let severity: 'error' | 'warning' | 'info' = 'info';
      const lowerRuleId = ruleId.toLowerCase();
      if (lowerRuleId.includes('injection') ||
          lowerRuleId.includes('xss') ||
          lowerRuleId.includes('sqli') ||
          lowerRuleId.includes('rce')) {
        severity = 'error';
      } else if (lowerRuleId.includes('weak') ||
                 lowerRuleId.includes('misconfig') ||
                 lowerRuleId.includes('info')) {
        severity = 'warning';
      }

      issues.push({
        tool: 'semgrep',
        severity,
        file: normalizePath(file, cwd),
        line: parseInt(lineStr, 10),
        col: 1, // 文本格式没有列信息
        ruleId,
        message: message.trim(),
      });
    }
  }

  return issues;
}

/**
 * 规范化文件路径
 */
function normalizePath(filePath: string, cwd: string): string {
  // 移除可能的绝对路径前缀
  let normalized = filePath;
  if (filePath.startsWith(cwd)) {
    normalized = filePath.substring(cwd.length + 1); // +1 移除路径分隔符
  }

  // 统一使用正斜杠
  return normalized.replace(/\\/g, '/');
}