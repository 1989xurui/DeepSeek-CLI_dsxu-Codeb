import { expect, test } from 'bun:test'
import { escapeHtml } from '../src/html.js'

test('escapeHtml escapes apostrophes with the expected numeric HTML entity', () => {
  expect(escapeHtml(`Tom's <tag> & "quote"`)).toBe('Tom&#39;s &lt;tag&gt; &amp; &quot;quote&quot;')
})
