import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render crashes so a single broken component doesn't leave a blank
 * page with nothing but a console message.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="type-display text-3xl">Something broke</h1>
        <p className="max-w-md text-textsecondary">
          That's on us, not you. Reloading usually clears it.
        </p>
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      </div>
    );
  }
}
