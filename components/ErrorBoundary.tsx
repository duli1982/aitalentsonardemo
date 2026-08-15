import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                    <div className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-slate-700">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-red-500/20 rounded-full">
                                <AlertTriangle className="h-10 w-10 text-red-500" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                        <p className="text-gray-400 mb-6">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        {this.state.error && (
                            <div className="bg-slate-900/50 p-3 rounded text-left mb-6 overflow-auto max-h-32">
                                <p className="text-xs text-red-400 font-mono">{this.state.error.toString()}</p>
                            </div>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
