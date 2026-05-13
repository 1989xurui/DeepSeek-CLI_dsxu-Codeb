import { describe, test, expect } from 'bun:test';
import {
  reverseString,
  isPalindrome,
  countCharacters,
  toCamelCase,
  toSnakeCase,
  truncate,
  containsAllVowels,
  generateRandomString
} from '../src/utils/string';

describe('String utilities', () => {
  describe('reverseString function', () => {
    test('should reverse simple strings', () => {
      expect(reverseString('hello')).toBe('olleh');
      expect(reverseString('world')).toBe('dlrow');
      expect(reverseString('12345')).toBe('54321');
    });

    test('should reverse empty string', () => {
      expect(reverseString('')).toBe('');
    });

    test('should reverse strings with spaces', () => {
      expect(reverseString('hello world')).toBe('dlrow olleh');
      expect(reverseString('a b c')).toBe('c b a');
    });

    test('should reverse strings with special characters', () => {
      expect(reverseString('!@#$%')).toBe('%$#@!');
      expect(reverseString('你好世界')).toBe('界世好你');
    });
  });

  describe('isPalindrome function', () => {
    test('should identify palindromes', () => {
      expect(isPalindrome('racecar')).toBe(true);
      expect(isPalindrome('A man a plan a canal Panama')).toBe(true);
      expect(isPalindrome('madam')).toBe(true);
      expect(isPalindrome('12321')).toBe(true);
    });

    test('should identify non-palindromes', () => {
      expect(isPalindrome('hello')).toBe(false);
      expect(isPalindrome('world')).toBe(false);
      expect(isPalindrome('12345')).toBe(false);
    });

    test('should handle case sensitivity', () => {
      expect(isPalindrome('Racecar')).toBe(true);
      expect(isPalindrome('Madam')).toBe(true);
    });

    test('should ignore punctuation and spaces', () => {
      expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true);
      expect(isPalindrome('Was it a car or a cat I saw?')).toBe(true);
    });
  });

  describe('countCharacters function', () => {
    test('should count characters in simple strings', () => {
      expect(countCharacters('hello')).toEqual({
        h: 1,
        e: 1,
        l: 2,
        o: 1
      });

      expect(countCharacters('aaa')).toEqual({ a: 3 });
    });

    test('should count characters with spaces and punctuation', () => {
      expect(countCharacters('hello world')).toEqual({
        h: 1,
        e: 1,
        l: 3,
        o: 2,
        ' ': 1,
        w: 1,
        r: 1,
        d: 1
      });
    });

    test('should handle empty string', () => {
      expect(countCharacters('')).toEqual({});
    });

    test('should handle special characters', () => {
      expect(countCharacters('!!!')).toEqual({ '!': 3 });
      expect(countCharacters('a@a@a')).toEqual({ a: 3, '@': 2 });
    });
  });

  describe('toCamelCase function', () => {
    test('should convert snake_case to camelCase', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld');
      expect(toCamelCase('my_variable_name')).toBe('myVariableName');
    });

    test('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
      expect(toCamelCase('my-variable-name')).toBe('myVariableName');
    });

    test('should handle spaces', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
      expect(toCamelCase('my variable name')).toBe('myVariableName');
    });

    test('should handle mixed cases', () => {
      expect(toCamelCase('Hello_World')).toBe('helloWorld');
      expect(toCamelCase('My-Variable-Name')).toBe('myVariableName');
    });

    test('should handle already camelCase', () => {
      expect(toCamelCase('helloWorld')).toBe('helloworld');
      expect(toCamelCase('myVariableName')).toBe('myvariablename');
    });
  });

  describe('toSnakeCase function', () => {
    test('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('helloWorld')).toBe('hello_world');
      expect(toSnakeCase('myVariableName')).toBe('my_variable_name');
    });

    test('should convert kebab-case to snake_case', () => {
      expect(toSnakeCase('hello-world')).toBe('hello_world');
      expect(toSnakeCase('my-variable-name')).toBe('my_variable_name');
    });

    test('should handle spaces', () => {
      expect(toSnakeCase('hello world')).toBe('hello_world');
      expect(toSnakeCase('my variable name')).toBe('my_variable_name');
    });

    test('should handle already snake_case', () => {
      expect(toSnakeCase('hello_world')).toBe('hello_world');
      expect(toSnakeCase('my_variable_name')).toBe('my_variable_name');
    });
  });

  describe('truncate function', () => {
    test('should truncate long strings', () => {
      expect(truncate('Hello world', 8)).toBe('Hello...');
      expect(truncate('This is a long string', 10)).toBe('This is...');
    });

    test('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
      expect(truncate('Short', 5)).toBe('Short');
    });

    test('should use custom ellipsis', () => {
      expect(truncate('Hello world', 8, '..')).toBe('Hello ..');
      expect(truncate('Hello world', 8, '')).toBe('Hello wo');
    });

    test('should handle edge cases', () => {
      expect(truncate('', 5)).toBe('');
      expect(truncate('Hello', 0)).toBe('...');
    });
  });

  describe('containsAllVowels function', () => {
    test('should detect strings with all vowels', () => {
      expect(containsAllVowels('aeiou')).toBe(true);
      expect(containsAllVowels('The quick brown fox jumps over the lazy dog')).toBe(true);
      expect(containsAllVowels('AeIoU')).toBe(true);
    });

    test('should detect strings missing vowels', () => {
      expect(containsAllVowels('hello')).toBe(false);
      expect(containsAllVowels('world')).toBe(false);
      expect(containsAllVowels('bcdfg')).toBe(false);
    });

    test('should handle case sensitivity', () => {
      expect(containsAllVowels('AEIOU')).toBe(true);
      expect(containsAllVowels('AeIoU')).toBe(true);
    });

    test('should handle empty string', () => {
      expect(containsAllVowels('')).toBe(false);
    });
  });

  describe('generateRandomString function', () => {
    test('should generate strings of correct length', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(20);
      const str3 = generateRandomString(0);

      expect(str1.length).toBe(10);
      expect(str2.length).toBe(20);
      expect(str3.length).toBe(0);
    });

    test('should generate different strings', () => {
      const str1 = generateRandomString(10);
      const str2 = generateRandomString(10);

      // Note: There's a very small chance these could be equal
      // but it's extremely unlikely for 10-character strings
      expect(str1).not.toBe(str2);
    });

    test('should only contain valid characters', () => {
      const str = generateRandomString(100);
      const validChars = /^[A-Za-z0-9]+$/;

      expect(validChars.test(str)).toBe(true);
    });
  });

  describe('integration tests', () => {
    test('should combine multiple string operations', () => {
      const original = 'Hello World';
      const reversed = reverseString(original);
      const camelCase = toCamelCase(original);
      const snakeCase = toSnakeCase(camelCase);

      expect(reversed).toBe('dlroW olleH');
      expect(camelCase).toBe('helloWorld');
      expect(snakeCase).toBe('hello_world');
    });

    test('should verify palindrome properties', () => {
      const palindrome = 'racecar';
      const reversed = reverseString(palindrome);

      expect(isPalindrome(palindrome)).toBe(true);
      expect(palindrome).toBe(reversed);

      const charCount = countCharacters(palindrome);
      expect(charCount.r).toBe(2);
      expect(charCount.a).toBe(2);
      expect(charCount.c).toBe(2);
      expect(charCount.e).toBe(1);
    });
  });
});