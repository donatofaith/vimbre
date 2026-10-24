import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not log user content or credentials. Add redacted diagnostics with the backend.
    console.error('The application could not render.')
  }
  render() {
    if (this.state.failed) return <main className="standalone"><h1>We could not open this page</h1><p>Please reload and try again.</p><button className="button button-secondary" onClick={() => window.location.reload()}>Reload page</button></main>
    return this.props.children
  }
}
