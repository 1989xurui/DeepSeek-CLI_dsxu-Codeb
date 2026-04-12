/**
 * R5-30 Property 模板生成器
 */

import type { PropertyTemplate } from './contract';

/**
 * 为函数生成 property test 代码
 */
export function generatePropertyTest(
  funcName: string,
  template: PropertyTemplate,
  importPath: string
): string {
  const generators: Record<PropertyTemplate, () => string> = {
    idempotent: () => `
import { fc } from 'fast-check';
import { ${funcName} } from '${importPath}';

test('${funcName} is idempotent', () => {
  fc.assert(
    fc.property(fc.anything(), (x) => {
      const once = ${funcName}(x);
      const twice = ${funcName}(once);
      expect(twice).toEqual(once);
    }),
    { numRuns: 100 }
  );
});`,

    invertible: () => `
import { fc } from 'fast-check';
import { encode, decode } from '${importPath}';

test('encode/decode are inverse', () => {
  fc.assert(
    fc.property(fc.string(), (x) => {
      expect(decode(encode(x))).toEqual(x);
    }),
    { numRuns: 100 }
  );
});`,

    monotonic: () => `
import { fc } from 'fast-check';
import { ${funcName} } from '${importPath}';

test('${funcName} is monotonic', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => {
      if (a <= b) {
        expect(${funcName}(a)).toBeLessThanOrEqual(${funcName}(b));
      }
    }),
    { numRuns: 100 }
  );
});`,

    invariant: () => `
import { fc } from 'fast-check';
import { ${funcName} } from '${importPath}';

test('${funcName} preserves length invariant', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), fc.integer(), (arr, x) => {
      const result = ${funcName}(arr, x);
      expect(result.length).toBe(arr.length + 1);
    }),
    { numRuns: 100 }
  );
});`,

    commutative: () => `
import { fc } from 'fast-check';
import { ${funcName} } from '${importPath}';

test('${funcName} is commutative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => {
      expect(${funcName}(a, b)).toEqual(${funcName}(b, a));
    }),
    { numRuns: 100 }
  );
});`,

    associative: () => `
import { fc } from 'fast-check';
import { ${funcName} } from '${importPath}';

test('${funcName} is associative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
      expect(${funcName}(${funcName}(a, b), c)).toEqual(${funcName}(a, ${funcName}(b, c)));
    }),
    { numRuns: 100 }
  );
});`,
  };

  return generators[template]().trim();
}

/**
 * 从函数签名推断适用的 property 模板
 */
export function inferTemplates(
  funcName: string,
  source: string
): PropertyTemplate[] {
  const templates: PropertyTemplate[] = [];
  const lower = funcName.toLowerCase();

  // 名称推断
  if (lower.includes('parse') || lower.includes('normalize') || lower.includes('format'))
    templates.push('idempotent');
  if (lower.includes('encode') || lower.includes('serialize') || lower.includes('compress'))
    templates.push('invertible');
  if (lower.includes('sort') || lower.includes('rank') || lower.includes('compare'))
    templates.push('monotonic');
  if (lower.includes('insert') || lower.includes('push') || lower.includes('append'))
    templates.push('invariant');
  if (lower.includes('add') || lower.includes('merge') || lower.includes('combine'))
    templates.push('commutative');
  if (lower.includes('concat') || lower.includes('compose'))
    templates.push('associative');

  // 源码推断
  if (source.includes('return ') && !source.includes('this.') && !source.includes('console.'))
    if (templates.length === 0) templates.push('idempotent'); // 默认：纯函数试幂等

  return templates;
}
