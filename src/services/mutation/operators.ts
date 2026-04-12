/**
 * R5-24 Mutation 操作符
 *
 * 10 类弱 mutation 操作，每个操作扫描源码生成候选 mutation。
 */

import type { Mutation, MutationOperator } from './contract';

type OperatorFn = (lines: string[], file: string) => Mutation[];

let _mutationIdCounter = 0;

function createMutation(
  operator: MutationOperator,
  file: string,
  line: number,
  before: string,
  after: string
): Mutation {
  return { id: `mut-${++_mutationIdCounter}`, operator, file, line, before, after };
}

/** 重置 ID 计数器（测试用） */
export function resetIdCounter() { _mutationIdCounter = 0; }

// M01: 算术运算符替换
const m01: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const replacements: [RegExp, string, string][] = [
    [/(?<!\+)\+(?!\+|=)/g, '+', '-'],
    [/(?<!-)-(?!-|=|>)/g, '-', '+'],
    [/(?<!\*)\*(?!\*|=)/g, '*', '/'],
    [/(?<!\/|\\)\/(?!\/|\*|=)/g, '/', '*'],
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
    for (const [rx, from, to] of replacements) {
      if (rx.test(line)) {
        muts.push(createMutation('M01', file, i + 1, line, line.replace(rx, to)));
        break; // 1 mutation per line per operator
      }
    }
  }
  return muts;
};

// M02: 关系运算符替换
const m02: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const pairs: [string, string][] = [
    ['===', '!=='], ['!==', '==='],
    ['==', '!='], ['!=', '=='],
    ['<=', '<'], ['>=', '>'],
    ['<', '<='], ['>', '>='],
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('//')) continue;
    for (const [from, to] of pairs) {
      if (line.includes(from)) {
        muts.push(createMutation('M02', file, i + 1, line, line.replace(from, to)));
        break;
      }
    }
  }
  return muts;
};

// M03: 逻辑运算符替换
const m03: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('&&')) {
      muts.push(createMutation('M03', file, i + 1, line, line.replace('&&', '||')));
    } else if (line.includes('||')) {
      muts.push(createMutation('M03', file, i + 1, line, line.replace('||', '&&')));
    }
  }
  return muts;
};

// M04: 边界值变化 (subset of M02 but specifically i < n → i <= n)
const m04: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const rx = /(\w+)\s*(<)\s*(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(rx);
    if (m && !lines[i].trimStart().startsWith('//')) {
      muts.push(createMutation('M04', file, i + 1, lines[i], lines[i].replace('<', '<=')));
    }
  }
  return muts;
};

// M05: 常量替换
const m05: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('//')) continue;

    if (/\btrue\b/.test(line) && !line.includes('import')) {
      muts.push(createMutation('M05', file, i + 1, line, line.replace(/\btrue\b/, 'false')));
    } else if (/\bfalse\b/.test(line) && !line.includes('import')) {
      muts.push(createMutation('M05', file, i + 1, line, line.replace(/\bfalse\b/, 'true')));
    } else if (/(?<!\w)0(?!\w|\.)/.test(line) && !line.includes('import') && !line.includes('//')) {
      muts.push(createMutation('M05', file, i + 1, line, line.replace(/(?<!\w)0(?!\w|\.)/, '1')));
    }
  }
  return muts;
};

// M06: 返回值删除
const m06: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const rx = /^(\s*)return\s+.+;/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(rx);
    if (m) {
      muts.push(createMutation('M06', file, i + 1, lines[i], `${m[1]}return;`));
    }
  }
  return muts;
};

// M07: 条件取反
const m07: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const rx = /if\s*\(([^)]+)\)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(rx);
    if (m) {
      const negated = lines[i].replace(rx, `if (!(${m[1]}))`);
      muts.push(createMutation('M07', file, i + 1, lines[i], negated));
    }
  }
  return muts;
};

// M08: 语句删除
const m08: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')
      || trimmed.startsWith('return') || trimmed.startsWith('import')
      || trimmed.startsWith('export') || trimmed === '{' || trimmed === '}'
      || trimmed.startsWith('if') || trimmed.startsWith('for')
      || trimmed.startsWith('while') || trimmed.startsWith('function')
      || trimmed.startsWith('class') || trimmed.startsWith('const ')
      || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
      continue;
    }
    // Delete non-structural statements
    if (trimmed.endsWith(';') || trimmed.endsWith(',')) {
      muts.push(createMutation('M08', file, i + 1, lines[i], ''));
    }
  }
  return muts;
};

// M09: 空集合替换
const m09: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('//')) continue;

    // [1,2,3] → []
    if (/\[.+\]/.test(line) && !line.includes('import')) {
      muts.push(createMutation('M09', file, i + 1, line, line.replace(/\[[^\]]+\]/, '[]')));
    }
    // "abc" → "" (non-empty string literals)
    else if (/"[^"]+"|'[^']+'/.test(line) && !line.includes('import') && !line.includes('require')) {
      muts.push(createMutation('M09', file, i + 1, line, line.replace(/"[^"]+"/, '""').replace(/'[^']+'/, "''")));
    }
  }
  return muts;
};

// M10: null 注入
const m10: OperatorFn = (lines, file) => {
  const muts: Mutation[] = [];
  const rx = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+);/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(rx);
    if (m && !lines[i].includes('import') && !lines[i].includes('require')) {
      const replaced = lines[i].replace(rx, `${lines[i].match(/const|let|var/)![0]} ${m[1]} = null;`);
      muts.push(createMutation('M10', file, i + 1, lines[i], replaced));
    }
  }
  return muts;
};

/** All operators indexed by ID */
export const OPERATORS: Record<MutationOperator, OperatorFn> = {
  M01: m01, M02: m02, M03: m03, M04: m04, M05: m05,
  M06: m06, M07: m07, M08: m08, M09: m09, M10: m10,
};

/**
 * 从源码生成所有候选 mutation
 */
export function generateMutations(
  sourceCode: string,
  file: string,
  disabledOperators?: MutationOperator[]
): Mutation[] {
  const lines = sourceCode.split('\n');
  const disabled = new Set(disabledOperators ?? []);
  const all: Mutation[] = [];

  for (const [id, fn] of Object.entries(OPERATORS)) {
    if (disabled.has(id as MutationOperator)) continue;
    all.push(...fn(lines, file));
  }

  return all;
}
