import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

export interface CodingTaskSpec {
  path: string;
  title: string;
  goal: string;
  acceptanceCriteria: string[];
  files: string[];
  verifyCommands: string[];
  constraints: string[];
  notes: string[];
}

export interface CodingTaskRunRecord {
  id: string;
  taskPath: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  goal: string;
  acceptanceCriteria: string[];
  files: string[];
  verifyCommands: string[];
}

type SectionName =
  | 'goal'
  | 'acceptanceCriteria'
  | 'files'
  | 'verifyCommands'
  | 'constraints'
  | 'notes'
  | null;

const SECTION_MAP: Record<string, Exclude<SectionName, null>> = {
  goal: 'goal',
  acceptance: 'acceptanceCriteria',
  acceptancecriteria: 'acceptanceCriteria',
  files: 'files',
  verify: 'verifyCommands',
  verifycommands: 'verifyCommands',
  constraints: 'constraints',
  notes: 'notes',
};

export class CodingTaskRunner {
  private runsDir: string;

  constructor(runsDir: string = '.dsxu/runs') {
    this.runsDir = resolve(runsDir);
    if (!existsSync(this.runsDir)) {
      mkdirSync(this.runsDir, { recursive: true });
    }
  }

  loadTask(taskFile: string): CodingTaskSpec {
    const path = resolve(taskFile);
    const raw = readFileSync(path, 'utf8');
    const lines = raw.split(/\r?\n/);

    let title = 'Untitled Coding Task';
    let currentSection: SectionName = null;

    const goalLines: string[] = [];
    const acceptanceCriteria: string[] = [];
    const files: string[] = [];
    const verifyCommands: string[] = [];
    const constraints: string[] = [];
    const notes: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('# ')) {
        title = trimmed.slice(2).trim();
        continue;
      }

      if (trimmed.startsWith('## ')) {
        const normalized = trimmed
          .slice(3)
          .trim()
          .toLowerCase()
          .replace(/[^a-z]/g, '');
        currentSection = SECTION_MAP[normalized] ?? null;
        continue;
      }

      const item = trimmed.replace(/^[-*]\s+/, '').trim();
      switch (currentSection) {
        case 'goal':
          goalLines.push(item);
          break;
        case 'acceptanceCriteria':
          acceptanceCriteria.push(item);
          break;
        case 'files':
          files.push(item);
          break;
        case 'verifyCommands':
          verifyCommands.push(item);
          break;
        case 'constraints':
          constraints.push(item);
          break;
        case 'notes':
          notes.push(item);
          break;
        default:
          break;
      }
    }

    return {
      path,
      title,
      goal: goalLines.join(' ').trim(),
      acceptanceCriteria,
      files,
      verifyCommands,
      constraints,
      notes,
    };
  }

  validateTask(task: CodingTaskSpec): string[] {
    const issues: string[] = [];

    if (!task.title || task.title === 'Untitled Coding Task') {
      issues.push('Task title is missing.');
    }
    if (!task.goal) {
      issues.push('Task goal is missing.');
    }
    if (task.acceptanceCriteria.length === 0) {
      issues.push('Acceptance criteria are missing.');
    }
    if (task.files.length === 0) {
      issues.push('Related files are missing.');
    }
    if (task.verifyCommands.length === 0) {
      issues.push('Verify commands are missing.');
    }

    return issues;
  }

  createRunRecord(task: CodingTaskSpec): CodingTaskRunRecord {
    const now = new Date().toISOString();
    const id = `coding-${Date.now()}`;
    const record: CodingTaskRunRecord = {
      id,
      taskPath: task.path,
      title: task.title,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      goal: task.goal,
      acceptanceCriteria: task.acceptanceCriteria,
      files: task.files,
      verifyCommands: task.verifyCommands,
    };

    const outputPath = this.getRunPath(id);
    writeFileSync(outputPath, JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  buildExecutionBrief(task: CodingTaskSpec): string {
    const lines: string[] = [];
    lines.push(`Task: ${task.title}`);
    lines.push(`Goal: ${task.goal}`);
    lines.push('');
    lines.push('Acceptance Criteria:');
    task.acceptanceCriteria.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
    lines.push('');
    lines.push('Related Files:');
    task.files.forEach(file => {
      lines.push(`- ${file}`);
    });
    lines.push('');
    lines.push('Verification Commands:');
    task.verifyCommands.forEach(command => {
      lines.push(`- ${command}`);
    });

    if (task.constraints.length > 0) {
      lines.push('');
      lines.push('Constraints:');
      task.constraints.forEach(item => {
        lines.push(`- ${item}`);
      });
    }

    if (task.notes.length > 0) {
      lines.push('');
      lines.push('Notes:');
      task.notes.forEach(item => {
        lines.push(`- ${item}`);
      });
    }

    return lines.join('\n');
  }

  ensureTaskDirectory(taskFile: string): void {
    const parent = dirname(resolve(taskFile));
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
  }

  private getRunPath(id: string): string {
    return join(this.runsDir, `${id}.json`);
  }
}
