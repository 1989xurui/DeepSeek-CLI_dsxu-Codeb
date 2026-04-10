/**
 * JSON修复工具 - P0-A补丁
 * 用于修复malformed tool call JSON，避免重新调用API
 * 参考：OpenRouter实测80%的malformed tool call可本地修复
 */

/**
 * 简单的JSON修复函数
 * 处理常见的JSON格式错误：
 * 1. 缺少引号
 * 2. 尾随逗号
 * 3. 注释
 * 4. 单引号
 * 5. 未转义字符
 */
export function simpleJsonRepair(jsonString: string): string {
  if (!jsonString || typeof jsonString !== 'string') {
    return '{}';
  }

  let result = jsonString.trim();

  // 如果以{开头但不以}结尾，尝试补全
  if (result.startsWith('{') && !result.endsWith('}')) {
    // 尝试找到匹配的}
    let braceCount = 1;
    for (let i = 1; i < result.length; i++) {
      if (result[i] === '{') braceCount++;
      else if (result[i] === '}') braceCount--;
      if (braceCount === 0) {
        // 找到了匹配的}
        result = result.substring(0, i + 1);
        break;
      }
    }
    // 如果没找到匹配的}，补一个
    if (braceCount > 0) {
      result += '}';
    }
  }

  // 移除JavaScript风格注释
  result = result.replace(/\/\/.*$/gm, ''); // 行注释
  result = result.replace(/\/\*[\s\S]*?\*\//g, ''); // 块注释

  // 修复尾随逗号
  result = result.replace(/,(\s*[\]}])/g, '$1');

  // 修复属性名缺少引号（简单情况）
  result = result.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // 修复单引号为双引号
  result = result.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, content) => {
    // 转义双引号
    const escaped = content.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  // 修复未转义的控制字符
  result = result.replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');

  return result;
}

/**
 * 尝试解析JSON，如果失败则尝试修复
 * @param jsonString 要解析的JSON字符串
 * @returns 解析后的对象或null
 */
export function tryParseJson(jsonString: string): any {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  // 第一次尝试：直接解析
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // 第二次尝试：简单修复
    try {
      const repaired = simpleJsonRepair(jsonString);
      return JSON.parse(repaired);
    } catch (e2) {
      // 第三次尝试：如果是空或只有空格，返回空对象
      if (jsonString.trim() === '') {
        return {};
      }
      return null;
    }
  }
}

/**
 * 在deepseek-proxy.ts中使用的包装函数
 * 用于解析tool call参数
 */
export function parseToolCallArguments(argsString: string): any {
  if (!argsString || argsString.trim() === '') {
    return {};
  }

  const parsed = tryParseJson(argsString);
  return parsed || {};
}