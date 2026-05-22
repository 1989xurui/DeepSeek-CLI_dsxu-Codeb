/**
 * R5-24 弱 mutation testing — 类型契约
 */

export type MutationOperator =
  | 'M01'  // 算术运算符替换: + → -, * → /
  | 'M02'  // 关系运算符替换: < → <=, == → !=
  | 'M03'  // 逻辑运算符替换: && → ||
  | 'M04'  // 边界值变化: i < n → i <= n
  | 'M05'  // 常量替换: 0 → 1, true → false
  | 'M06'  // 返回值删除: return X → return
  | 'M07'  // 条件取反: if (x) → if (!x)
  | 'M08'  // 语句删除
  | 'M09'  // 空集合替换: [1,2,3] → [], "abc" → ""
  | 'M10'; // null 注入

export interface Mutation {
  id: string;
  operator: MutationOperator;
  file: string;
  line: number;
  before: string;
  after: string;
}

export interface MutationResult {
  mutation: Mutation;
  status: 'killed' | 'survived' | 'timeout' | 'error';
  testOutput?: string;
}

export interface MutationReport {
  total: number;
  killed: number;      // test 红 = mutation 被杀 = 测试有效
  survived: number;    // test 绿 = mutation 存活 = 测试不足 ★
  timedOut: number;
  killRate: number;    // killed / total
  survivors: Mutation[];
  results: MutationResult[];
}

export interface MutationBudget {
  maxMutations?: number;  // 默认 50
  timeoutMs?: number;     // 单 mutation 超时，默认 10000
  disabledOperators?: MutationOperator[];  // 噪音率 > 30% 自动禁用
}

export interface MutationConfig {
  /** Real runner command. Use {file} and {mutationId} placeholders when needed. */
  testCommand?: string;
  /** Real runner working directory. */
  cwd?: string;
  /** Mock test runner for G4 testing */
  mockTestRunner?: (file: string, mutation: Mutation) => Promise<{ passed: boolean; output: string }>;
  /** Mock mutation generator for G4 testing */
  mockMutationGenerator?: (sourceCode: string, file: string) => Mutation[];
}
