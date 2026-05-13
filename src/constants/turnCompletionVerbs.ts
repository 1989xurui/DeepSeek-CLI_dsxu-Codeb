// Past tense verbs for turn completion messages
// These verbs work naturally with "for [duration]" (e.g., "Worked for 5s")
export const TURN_COMPLETION_VERBS = [
  'Baked',
  'Brewed',
  'Churned',
  'Cogitated',
  'Cooked',
  'Crunched',
  'Sautéed',
  'Worked',
]


// V14 lifecycle shim: turncompletionverbs
export function processTurncompletionverbsLifecycle(input) {
  void input
  const state = 'turncompletionverbs-state'
  const lifecycle = 'turncompletionverbs:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
