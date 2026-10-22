/**
 * ErrorBoundary.
 *
 * A render-time error would otherwise blank the whole application. The
 * boundary catches it, shows a recoverable state and keeps the rest of the
 * page alive.
 */

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Rendered instead of the default panel. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Notified when an error is caught, for logging. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-card border border-danger-border bg-danger-soft/50 p-6 text-center"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">This section could not be displayed</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            An unexpected error interrupted the page. Reloading usually clears it.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={this.reset}
          icon={<RotateCcw className="size-3.5" />}
        >
          Try again
        </Button>
      </div>
    )
  }
}
