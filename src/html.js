/**
 * Escapes HTML special characters in a string.
 * Maps: & -> &amp;, < -> &lt;, > -> &gt;, " -> &quot;, ' -> &#39;
 *
 * @param {string} input - The string to escape
 * @returns {string} The escaped string
 */
export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
