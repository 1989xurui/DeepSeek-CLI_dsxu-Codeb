/**
 * Backward-compatible /clear cache entrypoint.
 *
 * The implementation lives in DSXU's session cache control module so
 * resume/continue flows no longer depend on this legacy command file.
 */
export {
  clearDSXUSessionCaches,
  clearSessionCaches,
} from '../../dsxu/engine/dsxu-session-cache-control.js'
export type {
  DSXUSessionCacheControlResult,
  V15SessionCacheControlResult,
} from '../../dsxu/engine/dsxu-session-cache-control.js'
