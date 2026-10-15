"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Keeps the screen awake while the component that calls this is mounted (Wrench Mode, with greasy hands and a phone propped
// on the fender). Progressive enhancement: where the Screen Wake Lock API is missing, or the browser refuses (battery saver,
// policy), Wrench Mode works exactly as before and nothing is shown to the customer.
//
// The browser drops the lock on its own whenever the tab is hidden (phone locked, app switched), so it is re-requested when
// the tab becomes visible again. A refused request is retried only on the next visibility change, never in a loop.

export type WakeLockState = "pending" | "active" | "released" | "denied" | "unsupported";

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: "release", cb: () => void) => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

const noopSubscribe = () => () => {};
const apiSupported = () => typeof (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock?.request === "function";

export function useScreenWakeLock(): WakeLockState {
  const [state, setState] = useState<WakeLockState>("pending");
  // Support is read from the browser without a setState (the server snapshot says "supported" so hydration matches).
  const supported = useSyncExternalStore(noopSubscribe, apiSupported, () => true);

  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!supported || !api) return;
    let cancelled = false;
    let sentinel: Sentinel | null = null;
    let requesting = false;

    async function acquire() {
      if (cancelled || requesting || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      requesting = true;
      try {
        const s = await api!.request("screen");
        if (cancelled) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
        setState("active");
        s.addEventListener("release", () => {
          if (sentinel === s) {
            sentinel = null;
            if (!cancelled) setState("released");
          }
        });
      } catch {
        if (!cancelled) setState("denied");
      } finally {
        requesting = false;
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    void acquire();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const s = sentinel;
      sentinel = null;
      s?.release().catch(() => {});
    };
  }, [supported]);

  return supported ? state : "unsupported";
}
