"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Records a page view for the admin analytics.
//
// Why a client component instead of recording on the server: guide and vehicle
// pages use generateStaticParams, so they're prerendered at build time. A
// server-side write there would fire once during the build and never again.
// This fires per actual visit.
//
// Deliberately minimal: one fire-and-forget POST, no cookies, no third party,
// no identifiers beyond the session the user already has. keepalive lets it
// complete even if the visitor navigates away immediately. Failures are
// swallowed -- analytics must never surface an error to a user reading a
// repair guide.
// ---------------------------------------------------------------------------

export default function ViewTracker({
  type,
  objectId,
  objectType,
}: {
  type: "guide.viewed" | "vehicle.viewed";
  objectId: string;
  objectType: string;
}) {
  // React runs effects twice in development strict mode; this guard keeps one
  // visit from being counted as two.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    try {
      fetch("/api/events/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, objectId, objectType, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {
        /* analytics is never load-bearing */
      });
    } catch {
      /* ignore */
    }
  }, [type, objectId, objectType]);

  return null;
}
