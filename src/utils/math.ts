/**
 * 简单的数学工具函数
 */

/**
 * 加法函数
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * 减法函数
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * 乘法函数
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * 除法函数
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

/**
 * 计算阶乘
 */
export function factorial(n: number): number {
  if (n < 0) {
    throw new Error('Factorial is not defined for negative numbers');
  }
  if (n === 0 || n === 1) {
    return 1;
  }
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * 判断是否为质数
 */
export function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;

  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}