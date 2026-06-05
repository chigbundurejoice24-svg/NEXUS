/**
 * ErrorBoundary.tsx — Catches runtime crashes and shows a friendly UI
 * instead of a white screen. Wraps the entire app in App.tsx.
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props  { children: ReactNode; fallback?: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console — could wire to Sentry here
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold dark:text-white">Something went wrong</h2>
          <p className="text-sm text-aegis-tertiary-dark">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5B3CF5] to-[#3B5BDB] text-white rounded-xl text-sm font-medium"
            >
              <RefreshCw size={14} /> Try again
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="px-5 py-2.5 border border-border text-aegis-secondary-dark rounded-xl text-sm"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
