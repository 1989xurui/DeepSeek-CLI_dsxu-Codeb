export type OllamaEmbedOptions = {
  baseUrl?: string
  model?: string
  timeout?: number
}

export function getEmbeddingDimension(model = 'nomic-embed-text'): number {
  if (model === 'bge-m3') return 1024
  if (model === 'nomic-embed-text') return 768
  if (model === 'jina/jina-embeddings-v2-base-code') return 768
  return 768
}

export function createOllamaEmbedFn(options: OllamaEmbedOptions = {}) {
  const model = options.model ?? 'nomic-embed-text'
  const dim = getEmbeddingDimension(model)
  return async (texts: string[]): Promise<number[][]> => {
    return texts.map((text) => hashEmbedding(`${model}:${text}`, dim))
  }
}

export function hashEmbedding(text: string, dim: number): number[] {
  const vector = new Array(dim).fill(0)
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    vector[(i * 31 + code) % dim] += (code % 37) + 1
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}
