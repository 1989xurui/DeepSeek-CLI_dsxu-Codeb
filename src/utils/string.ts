/**
 * String utility functions.
 */

/**
 * Reverse a string.
 */
export function reverseString(str: string): string {
  return str.split('').reverse().join('')
}

/**
 * Return whether a string is a palindrome after normalization.
 */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '')
  return cleaned === reverseString(cleaned)
}

/**
 * Count character occurrences in a string.
 */
export function countCharacters(str: string): Record<string, number> {
  const result: Record<string, number> = {}

  for (const char of str) {
    result[char] = (result[char] || 0) + 1
  }

  return result
}

/**
 * Convert a string to camelCase.
 */
export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Convert a string to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]+/g, '_')
}

/**
 * Truncate a string and append an ellipsis when needed.
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis: string = '...',
): string {
  if (str.length <= maxLength) {
    return str
  }

  // Non-positive lengths collapse to the ellipsis.
  if (maxLength <= 0) {
    return ellipsis
  }

  // Ensure the requested length can fit at least part of the ellipsis.
  if (maxLength <= ellipsis.length) {
    return ellipsis.slice(0, maxLength)
  }

  return str.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * Return whether a string contains every vowel.
 */
export function containsAllVowels(str: string): boolean {
  const vowels = 'aeiou'
  const lowerStr = str.toLowerCase()

  for (const vowel of vowels) {
    if (!lowerStr.includes(vowel)) {
      return false
    }
  }

  return true
}

/**
 * Generate a random alphanumeric string.
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

/**
 * Capitalize the first character of a string.
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}
