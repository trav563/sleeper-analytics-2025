import { Component } from 'react';
import ErrorState from './ui/ErrorState';

/**
 * Per-route error boundary so a crash inside one feature renders a recoverable
 * error panel instead of blanking the whole app (the only boundary before this
 * was the app-level one in main.jsx). Key it by route path so navigating away
 * clears a caught error automatically.
 */
class RouteErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Route render error:', error, info?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorState
                    className="h-[calc(100vh-4rem)]"
                    message="This page hit an unexpected error."
                    onRetry={() => this.setState({ hasError: false })}
                />
            );
        }
        return this.props.children;
    }
}

export default RouteErrorBoundary;
