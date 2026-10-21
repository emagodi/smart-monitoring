import { Component, Suspense, lazy, type ComponentType, type ErrorInfo, type ReactNode } from "react";

/**
 * Route-level code splitting: each page's code is downloaded the first time it is opened (the first screen loads a
 * fraction of the app), and pages the user is likely to visit next are fetched in the background when idle.
 *
 * After a new deployment an open tab may ask for a page file that no longer exists (file names change with each
 * build). In that case the page is reloaded once so the browser picks up the new build instead of showing an error.
 */
const RELOAD_KEY = "tms.chunk-reload";

function load<T>(factory: () => Promise<T>): Promise<T> {
  return factory().then(
    (m) => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* storage unavailable */
      }
      return m;
    },
    (err) => {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!reloaded) sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        reloaded = true; // no storage: do not risk a reload loop
      }
      if (!reloaded) {
        window.location.reload();
        return new Promise<T>(() => undefined); // keep the loader on screen while the page reloads
      }
      throw err;
    }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<P extends Record<string, any>>(factory: () => Promise<{ default: ComponentType<P> }>) {
  const Lazy = lazy(() => load(factory));
  const Page = (props: P) => (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Lazy {...props} />
      </Suspense>
    </PageErrorBoundary>
  );
  // Warm the most used pages once the browser is idle, so the first click on them is instant.
  prefetchQueue.push(() => void factory().catch(() => undefined));
  schedulePrefetch();
  return Page;
}

const prefetchQueue: Array<() => void> = [];
let prefetchScheduled = false;
function schedulePrefetch() {
  if (prefetchScheduled || typeof window === "undefined") return;
  prefetchScheduled = true;
  const run = () => {
    // A few at a time, after the first screen has had the network to itself.
    const next = prefetchQueue.splice(0, 3);
    next.forEach((fn) => fn());
    if (prefetchQueue.length) idle(run, 1500);
  };
  idle(run, 4000);
}

function idle(fn: () => void, delay: number) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 3000 }) : fn()), delay);
}

/** Shown in the content area while a page's code downloads (the sidebar and header stay on screen). */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
          <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600 border-r-red-500 dark:border-slate-800 dark:border-t-blue-400 dark:border-r-red-400" />
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading…</span>
      </div>
    </div>
  );
}

/**
 * If a page crashes while rendering, show a friendly card in the content area (sidebar and header keep working)
 * instead of a blank white screen. "Try again" re-mounts the page.
 */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; key: number }> {
  state = { error: null as Error | null, key: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return <div key={this.state.key}>{this.props.children}</div>;
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="max-w-md rounded-[24px] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-red-500 text-xl font-bold text-white">!</span>
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-50">This page hit a problem</h2>
          <p className="mt-1 text-xs text-slate-500">The rest of the system is fine. Try again, or reload if it keeps happening.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))} className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300">
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
