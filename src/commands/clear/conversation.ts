/**
 * Backward-compatible /clear conversation entrypoint.
 *
 * The implementation lives in DSXU's conversation control module so UI and
 * runtime callers can migrate away from this legacy command file.
 */
export {
  clearDSXUConversation,
  clearConversation,
} from '../../dsxu/engine/dsxu-conversation-control.js'
