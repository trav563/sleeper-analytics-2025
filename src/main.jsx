import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // fetchSleeper already retries 2x internally; React Query's default 3
      // retries on top of that meant up to ~9 network attempts per failure.
      retry: 1,
      staleTime: 60 * 1000,
      // Tab refocus was triggering refetch storms against Sleeper/ESPN.
      refetchOnWindowFocus: false,
    },
  },
})

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm text-text-dim">
              This page hit an unexpected error. Reloading usually clears it — if it keeps
              happening, the league may have data we don't handle yet.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-4 rounded-md bg-signal text-ink font-semibold hover:bg-signal/90 transition-colors"
            >
              Reload
            </button>
            {/* Stack traces are for us, not for testers — dev only. */}
            {import.meta.env.DEV && (
              <details className="text-left mt-4 text-xs text-text-mute" style={{ whiteSpace: 'pre-wrap' }}>
                <summary className="cursor-pointer">Error detail (dev)</summary>
                {this.state.error && this.state.error.toString()}
                {'\n'}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
