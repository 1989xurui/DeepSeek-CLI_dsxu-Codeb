/**
 * R5-25 Voyage AI embedding 适配层
 */

import type { EmbedRequest, EmbedResponse } from './contract';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-code-3';

/**
 * 调用 Voyage AI API 获取 embedding
 *
 * 需要环境变量 VOYAGE_API_KEY
 */
export async function embed(
  req: EmbedRequest,
  mockEmbed?: (req: EmbedRequest) => Promise<EmbedResponse>
): Promise<EmbedResponse> {
  if (mockEmbed) {
    return mockEmbed(req);
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set — cannot call Voyage AI API');
  }

  const payload = {
    model: MODEL,
    input: req.texts,
    input_type: req.inputType,
  };

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { data: Array<{ embedding: number[] }> };
  return {
    vectors: data.data.map(d => d.embedding),
  };
}
