import { feature } from 'bun:bundle'
import type { PendingClassifierCheck } from '../../../types/permissions.js'
import { logError } from '../../../utils/log.js'
import type { PermissionDecision } from '../../../utils/permissions/PermissionResult.js'
import type { PermissionUpdate } from '../../../utils/permissions/PermissionUpdateSchema.js'
import type { PermissionContext } from '../PermissionContext.js'

const AUTOMATED_PERMISSION_CHECK_TIMEOUT_MS = 5_000

type CoordinatorPermissionParams = {
  ctx: PermissionContext
  pendingClassifierCheck?: PendingClassifierCheck | undefined
  updatedInput: Record<string, unknown> | undefined
  suggestions: PermissionUpdate[] | undefined
  permissionMode: string | undefined
}

async function withAutomatedCheckTimeout<T>(
  promise: Promise<T>,
  label: string,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => {
        timer = setTimeout(() => {
          logError(
            new Error(
              `Automated permission check timed out before dialog: ${label}`,
            ),
          )
          resolve(null)
        }, AUTOMATED_PERMISSION_CHECK_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Handles the coordinator worker permission flow.
 *
 * For coordinator workers, automated checks (hooks and classifier) are
 * awaited sequentially before falling through to the interactive dialog.
 *
 * Returns a PermissionDecision if the automated checks resolved the
 * permission, or null if the caller should fall through to the
 * interactive dialog.
 */
async function handleCoordinatorPermission(
  params: CoordinatorPermissionParams,
): Promise<PermissionDecision | null> {
  const { ctx, updatedInput, suggestions, permissionMode } = params

  try {
    // 1. Try permission hooks first (fast, local)
    const hookResult = await withAutomatedCheckTimeout(
      ctx.runHooks(permissionMode, suggestions, updatedInput),
      'permission-hooks',
    )
    if (hookResult) return hookResult

    // 2. Try classifier (slow, inference -- bash only)
    const classifierResult = feature('BASH_CLASSIFIER')
      ? await withAutomatedCheckTimeout(
          Promise.resolve(
            ctx.tryClassifier?.(params.pendingClassifierCheck, updatedInput) ??
              null,
          ),
          'bash-classifier',
        )
      : null
    if (classifierResult) {
      return classifierResult
    }
  } catch (error) {
    // If automated checks fail unexpectedly, fall through to show the dialog
    // so the user can decide manually. Non-Error throws get a context prefix
    // so the log is traceable — intentionally NOT toError(), which would drop
    // the prefix.
    if (error instanceof Error) {
      logError(error)
    } else {
      logError(new Error(`Automated permission check failed: ${String(error)}`))
    }
  }

  // 3. Neither resolved (or checks failed) -- fall through to dialog below.
  // Hooks already ran, classifier already consumed.
  return null
}

export { handleCoordinatorPermission }
export type { CoordinatorPermissionParams }
