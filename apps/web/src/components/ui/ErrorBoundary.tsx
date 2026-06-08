import React, { Component, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // DECISIÓN: en producción aquí iría Sentry.captureException(error).
    // Por ahora solo logueamos en consola de desarrollo.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    this.props.onError?.(error);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const devMessage = import.meta.env.DEV ? this.state.error?.message : undefined;

    return (
      <div className="flex h-full min-h-[200px] items-center justify-center p-8">
        {devMessage != null ? (
          <ErrorState message={devMessage} onRetry={this.handleRetry} />
        ) : (
          <ErrorState onRetry={this.handleRetry} />
        )}
      </div>
    );
  }
}
