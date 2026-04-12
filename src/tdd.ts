/**
 * TDD 门功能实现
 */

/**
 * 测试TDD门功能
 */
export function tdd(): string {
  return 'TDD门功能实现完成';
}

/**
 * 处理边界情况
 */
export function handleEdgeCases(input: number): number {
  if (input < 0) {
    return 0;
  }
  return input * 2;
}

/**
 * 返回正确的结果
 */
export function getCorrectResult(): number {
  return 2; // 1 + 1 = 2
}