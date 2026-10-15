"use client";

import { useEffect, useRef } from "react";

// While the Wrench Mode overlay is open, the browser Back gesture (phone swipe, Android back, desktop Back button) closes the
// overlay instead of leaving the guide page. Closed, the hook does nothing, so ordinary navigation is exactly as before.
//
// How: opening pushes ONE history entry for the current URL (native pushState, which Next integrates with its router; same URL,
// so no navigation happens). Back then pops that entry and fires popstate, which closes the overlay and keeps the session. When
// the overlay is closed any other way (Overall Guide, confirmed exit, finish) the entry is popped with history.back() so the
// customer never has to press Back twice on the same page.
//
// Known edges. (1) history.back() is applied asynchronously by the browser, so a navigation fired in the same millisecond as
// closing the overlay (a script, not a person) can be undone by the pending pop. (2) A reload while the overlay is open leaves
// that one extra same-URL entry behind (it cannot be popped from a page that no longer knows about it), so the first Back after
// such a reload stays on the page.

export function useWrenchBackGuard(open: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  // Declared BEFORE the guard effect: on unmount React runs cleanups in declaration order, so this flag is already true when the
  // guard's cleanup runs. Navigating away must not call history.back() on top of the navigation.
  const unmounting = useRef(false);
  useEffect(() => {
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let entryOnStack = true;
    window.history.pushState(null, "", window.location.href);

    const onPop = () => {
      entryOnStack = false; // the customer's Back just consumed our entry
      onBackRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (entryOnStack && !unmounting.current) {
        // Closed by the UI, not by Back: remove our entry. The listener is gone, so nothing reacts to this pop.
        window.history.back();
      }
    };
  }, [open]);
}
