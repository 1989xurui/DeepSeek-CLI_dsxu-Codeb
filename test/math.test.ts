import { describe, test, expect } from 'bun:test';
import { add, subtract, multiply, divide, factorial, isPrime } from '../src/utils/math';

describe('Math utilities', () => {
  describe('add function', () => {
    test('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
      expect(add(10, 20)).toBe(30);
    });

    test('should add negative numbers', () => {
      expect(add(-2, 3)).toBe(1);
      expect(add(5, -10)).toBe(-5);
      expect(add(-3, -4)).toBe(-7);
    });

    test('should add zero', () => {
      expect(add(0, 5)).toBe(5);
      expect(add(7, 0)).toBe(7);
      expect(add(0, 0)).toBe(0);
    });
  });

  describe('subtract function', () => {
    test('should subtract two numbers', () => {
      expect(subtract(5, 3)).toBe(2);
      expect(subtract(10, 20)).toBe(-10);
    });

    test('should handle negative numbers', () => {
      expect(subtract(-2, 3)).toBe(-5);
      expect(subtract(5, -10)).toBe(15);
    });
  });

  describe('multiply function', () => {
    test('should multiply two numbers', () => {
      expect(multiply(2, 3)).toBe(6);
      expect(multiply(5, 0)).toBe(0);
      expect(multiply(-2, 3)).toBe(-6);
    });

    test('should multiply by zero', () => {
      expect(multiply(0, 5)).toBe(0);
      expect(multiply(7, 0)).toBe(0);
    });
  });

  describe('divide function', () => {
    test('should divide two numbers', () => {
      expect(divide(6, 3)).toBe(2);
      expect(divide(10, 2)).toBe(5);
      expect(divide(-6, 3)).toBe(-2);
    });

    test('should throw error when dividing by zero', () => {
      expect(() => divide(5, 0)).toThrow('Division by zero');
      expect(() => divide(0, 0)).toThrow('Division by zero');
    });

    test('should handle division by one', () => {
      expect(divide(5, 1)).toBe(5);
      expect(divide(-7, 1)).toBe(-7);
    });
  });

  describe('factorial function', () => {
    test('should calculate factorial of positive numbers', () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
      expect(factorial(2)).toBe(2);
      expect(factorial(3)).toBe(6);
      expect(factorial(5)).toBe(120);
      expect(factorial(7)).toBe(5040);
    });

    test('should throw error for negative numbers', () => {
      expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
      expect(() => factorial(-5)).toThrow('Factorial is not defined for negative numbers');
    });
  });

  describe('isPrime function', () => {
    test('should identify prime numbers', () => {
      expect(isPrime(2)).toBe(true);
      expect(isPrime(3)).toBe(true);
      expect(isPrime(5)).toBe(true);
      expect(isPrime(7)).toBe(true);
      expect(isPrime(11)).toBe(true);
      expect(isPrime(13)).toBe(true);
    });

    test('should identify non-prime numbers', () => {
      expect(isPrime(1)).toBe(false);
      expect(isPrime(4)).toBe(false);
      expect(isPrime(6)).toBe(false);
      expect(isPrime(8)).toBe(false);
      expect(isPrime(9)).toBe(false);
      expect(isPrime(10)).toBe(false);
    });

    test('should handle edge cases', () => {
      expect(isPrime(0)).toBe(false);
      expect(isPrime(-1)).toBe(false);
      expect(isPrime(-5)).toBe(false);
    });
  });

  describe('integration tests', () => {
    test('should perform multiple operations correctly', () => {
      // (2 + 3) * 4 = 20
      const result1 = multiply(add(2, 3), 4);
      expect(result1).toBe(20);

      // (10 - 2) / 4 = 2
      const result2 = divide(subtract(10, 2), 4);
      expect(result2).toBe(2);

      // factorial(5) - 10 = 110
      const result3 = subtract(factorial(5), 10);
      expect(result3).toBe(110);
    });

    test('should verify prime numbers with factorial', () => {
      // 5 is prime and factorial(5) = 120
      expect(isPrime(5)).toBe(true);
      expect(factorial(5)).toBe(120);

      // 7 is prime and factorial(7) = 5040
      expect(isPrime(7)).toBe(true);
      expect(factorial(7)).toBe(5040);
    });
  });
});