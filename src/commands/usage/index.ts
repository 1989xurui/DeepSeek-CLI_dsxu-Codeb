import { ARCHIVED_CLOUD_AVAILABILITY, type Command } from '../../types/command.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

export default {
  type: 'local-jsx',
  name: 'usage',
  description: 'Show provider plan usage limits',
  // DSXU usage is handled by the local provider usage/cost path.
  availability: [ARCHIVED_CLOUD_AVAILABILITY],
  isEnabled: () => !isDsxuRuntimeMode(),
  load: () => import('./usage.js'),
} satisfies Command
