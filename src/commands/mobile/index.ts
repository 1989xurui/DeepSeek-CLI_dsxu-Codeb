import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Archived mobile app information',
  isEnabled: () => !isDsxuRuntimeMode(),
  isHidden: true,
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile
