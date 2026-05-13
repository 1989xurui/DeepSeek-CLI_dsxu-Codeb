import type { Command } from '../../commands.js'
import { isDsxuRuntimeMode, isEnvTruthy } from '../../utils/envUtils.js'

const doctor: Command = {
  name: 'doctor',
  get description() {
    return isDsxuRuntimeMode()
      ? 'Diagnose and verify your DSXU Code installation and settings'
      : 'Diagnose and verify your DSXU Code installation and settings'
  },
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_DOCTOR_COMMAND),
  type: 'local-jsx',
  load: () => import('./doctor.js'),
}

export default doctor

export function getDsxuDoctorCommandRuntimeProfile(): {
  command: '/doctor'
  runtime: 'DSXU Diagnostic Command'
  activationEvidence: readonly string[]
} {
  return {
    command: '/doctor',
    runtime: 'DSXU Diagnostic Command',
    activationEvidence: [
      'description is resolved dynamically from DSXU_CODE_MODE',
      'DSXU runtime no longer presents DSXU Code as the diagnosed product',
      'command remains on the local JSX diagnostic path',
    ],
  }
}


// V14 command lifecycle shim: doctor
export function processDoctorCommandLifecycle(input) {
  void input
  const state = 'doctor-command-state'
  const lifecycle = 'doctor:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'doctor',
  }
}

export function runDoctorCommand(input) {
  return processDoctorCommandLifecycle(input)
}
