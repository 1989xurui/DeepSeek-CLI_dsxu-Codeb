import * as React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class SentryErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}


// V14 lifecycle shim: sentryerrorboundary
export function processSentryerrorboundaryLifecycle(input) {
  void input
  const state = 'sentryerrorboundary-state'
  const lifecycle = 'sentryerrorboundary:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
