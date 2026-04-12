/**
 * R5-26 self-RAG — 经验注入
 */

import type { ExperienceRecord } from './types';
import { ExperienceStore } from './store';

/**
 * 从 ExperienceStore 检索相似经验，注入到 system prompt
 */
export async function injectExperienceContext(
  store: ExperienceStore,
  taskDescription: string,
  baseSystemPrompt: string,
  k: number = 3
): Promise<string> {
  const records = await store.retrieve(taskDescription, k);

  if (records.length === 0) {
    return baseSystemPrompt;
  }

  const context = formatExperienceContext(records);
  return `${baseSystemPrompt}\n\n${context}`;
}

function formatExperienceContext(records: ExperienceRecord[]): string {
  const lines: string[] = [
    `[ExperienceStore Context — 来自 ${records.length} 次相似历史任务]`,
    '',
  ];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const label = r.outcome === 'success' ? `成功，分数 ${r.finalScore}` : `失败，分数 ${r.finalScore}`;
    lines.push(`历史任务 ${i + 1}（${label}）：`);
    lines.push(`  - 任务：${r.taskDescription.slice(0, 200)}`);
    lines.push(`  - 关键决策：${r.plan.slice(0, 200)}`);

    if (r.outcome === 'failure' && r.criticReason) {
      lines.push(`  - **避免**：${r.criticReason}`);
    } else if (r.outcome === 'success') {
      lines.push(`  - 教训：${r.criticReason || '按计划执行成功'}`);
    }
    lines.push('');
  }

  lines.push('请参考但不要照搬。当前任务有自身上下文。');
  return lines.join('\n');
}
