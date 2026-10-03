// QVAULT — ErrorBoundary (WAVE4-CONTRACT.md §A.2).
// Class component: menangkap error render di subtree-nya supaya satu halaman
// yang crash tidak menumbangkan seluruh app. Menampilkan kartu + opsi reload.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { secureCopy } from "../lib/clipboard";

interface Props {
  children: ReactNode;
  /** UI pengganti opsional saat terjadi error. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Biarkan tercatat di console supaya masih bisa di-debug.
    console.error("QVAULT crashed:", error, info.componentStack);
  }

  onReload = (): void => {
    window.location.reload();
  };

  onCopy = async (): Promise<void> => {
    const { error } = this.state;
    const details = [
      error?.name ?? "Error",
      error?.message ?? "Unknown error",
      error?.stack ?? "",
      `url: ${window.location.href}`,
      `time: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await secureCopy(details, 30);
      this.setState({ copied: true });
    } catch {
      this.setState({ copied: false });
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="grid min-h-[60vh] place-items-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center text-ink">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Something went wrong
          </h2>
          <p className="mt-2 break-words text-sm text-muted">{error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={this.onReload}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => void this.onCopy()}
              className="rounded-xl border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
            >
              {this.state.copied ? "Copied" : "Copy details"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
