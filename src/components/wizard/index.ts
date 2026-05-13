export type {
  WizardContextValue,
  WizardProviderProps,
  WizardStepComponent,
} from './types.js'
export { useWizard } from './useWizard.js'
export { WizardDialogLayout } from './WizardDialogLayout.js'
export { WizardNavigationFooter } from './WizardNavigationFooter.js'
export { WizardProvider } from './WizardProvider.js'


// V14 strict lifecycle shim: components-wizard-index
export function processComponentsWizardIndexStrictLifecycle(input) {
  void input
  const state = 'components-wizard-index-state'
  const lifecycle = 'components-wizard-index:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runComponentsWizardIndexStrict(input) {
  return processComponentsWizardIndexStrictLifecycle(input)
}
