/**
 * MSA L3 Embedding — Ollama 本地嵌入适配器
 *
 * 支持模型（可插拔）：
 * - nomic-embed-text（默认，Ollama 生态最火，8192 token 长上下文）
 * - jina/jina-embeddings-v2-base-code（代码专精，需 Ollama 拉取）
 * - bge-m3（中英跨语言最强，需 Ollama 拉取）
 *
 * 接入方式：
 *   1. 安装 Ollama: https://ollama.com
 *   2. 拉取模型: ollama pull nomic-embed-text
 *   3. 本模块自动连接 localhost:11434
 *
 * 降级策略：Ollama 不可用时自动降级为 simpleHash（30-40% 准确率）
 */

export interface OllamaEmbeddingConfig {
  /** Ollama API 地址（默认 http://localhost:11434） */
  baseUrl?: string;
  /** 嵌入模型名称（默认 nomic-embed-text） */
  model?: string;
  /** 请求超时 ms（默认 10000） */
  timeout?: number;
  /** 嵌入维度（nomic=768, jina-code=768, bge-m3=1024） */
  dimension?: number;
}

const DEFAULTS: Required<OllamaEmbeddingConfig> = {
  baseUrl: 'http://localhost:11434',
  model: 'nomic-embed-text',
  timeout: 10000,
  dimension: 768,
};

/** 模型维度映射 */
const MODEL_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'jina/jina-embeddings-v2-base-code': 768,
  'bge-m3': 1024,
};

/**
 * 创建 Ollama 嵌入函数 — 给 MSA L3 的 embedFn 用
 *
 * 用法：
 *   const embedFn = createOllamaEmbedFn();
 *   const l3 = new L3Archive({ embedFn, embeddingDim: 768 });
 */
export function createOllamaEmbedFn(config?: OllamaEmbeddingConfig) {
  const cfg = {
    ...DEFAULTS,
    ...config,
    dimension: config?.dimension ?? MODEL_DIMENSIONS[config?.model ?? DEFAULTS.model] ?? DEFAULTS.dimension,
  };

  let ollamaAvailable: boolean | null = null; // null = 未检测

  /**
   * 批量嵌入
   */
  return async function embedTexts(texts: string[]): Promise<number[][]> {
    // 首次调用检测 Ollama 是否可用
    if (ollamaAvailable === null) {
      ollamaAvailable = await checkOllamaHealth(cfg.baseUrl, cfg.timeout);
      if (ollamaAvailable) {
        console.log(`[MSA-Embed] ✅ Ollama 连接成功: ${cfg.baseUrl}, 模型: ${cfg.model}`);
      } else {
        console.warn(`[MSA-Embed] ⚠️ Ollama 不可用，降级为 simpleHash（检索准确率 ~30-40%）`);
        console.warn(`[MSA-Embed] 💡 安装: https://ollama.com → ollama pull ${cfg.model}`);
      }
    }

    if (!ollamaAvailable) {
      return texts.map(t => fallbackHash(t, cfg.dimension));
    }

    // 逐条请求 Ollama（Ollama embedding API 不支持批量）
    const results: number[][] = [];
    for (const text of texts) {
      try {
        const vec = await callOllamaEmbed(cfg.baseUrl, cfg.model, text, cfg.timeout);
        results.push(vec);
      } catch (err) {
        // 单条失败降级为 hash
        console.warn(`[MSA-Embed] 嵌入失败，降级: ${(err as Error).message}`);
        results.push(fallbackHash(text, cfg.dimension));
      }
    }

    return results;
  };
}

/**
 * 调用 Ollama Embedding API
 */
async function callOllamaEmbed(
  baseUrl: string,
  model: string,
  text: string,
  timeout: number,
): Promise<number[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Ollama API ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = await resp.json() as { embedding: number[] };

    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error('Ollama 返回空嵌入向量');
    }

    return data.embedding;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 健康检查：Ollama 是否在运行
 */
async function checkOllamaHealth(baseUrl: string, timeout: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, 3000));

    const resp = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 降级 Hash — 与 L3Archive 的 fallbackEmbed 一致
 * 生产环境不应走到这里
 */
function fallbackHash(text: string, dim: number): number[] {
  const vec: number[] = new Array(dim).fill(0);
  const primes = [31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const dimIdx = i % dim;
    vec[dimIdx] += code * primes[i % primes.length];
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * 获取模型对应的嵌入维度
 */
export function getEmbeddingDimension(model: string): number {
  return MODEL_DIMENSIONS[model] ?? 768;
}
