"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

// ---------------------------------------------------------------------------
// "Ask Crankcase" -- the command interface at the top of the Command Center.
//
// IMPORTANT, and the reason this component is written the way it is: there is
// no AI backend connected. This does NOT fake an answer. It sends the query to
// /api/admin/command, which classifies it against a real intent registry and
// either (a) routes to the matching admin page/filter for the queries it can
// genuinely answer today by deterministic lookup, or (b) replies honestly that
// natural-language answering is not connected yet.
//
// The architecture is the point: the intent registry, the request/response
// shape, and this UI are all what an LLM-backed handler would plug into. When
// that day comes, only the server handler changes.
// ---------------------------------------------------------------------------

export interface CommandSuggestion {
  label: string;
  hint?: string;
}

export interface CommandResult {
  status: "routed" | "answered" | "unavailable" | "error";
  message: string;
  href?: string;
  detail?: string;
}

const EXAMPLES: CommandSuggestion[] = [
  { label: "Show me new users this week", hint: "routes to Users" },
  { label: "How many vehicles were added this month?", hint: "routes to Vehicles" },
  { label: "Which guides are getting the most views?", hint: "routes to Guides" },
  { label: "Show me failed payments", hint: "routes to Revenue" },
  { label: "Find guides missing torque specifications", hint: "routes to Guides" },
  { label: "What's changed on the site today?", hint: "routes to Audit" },
];

export default function CommandBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl-K focuses the bar, the way an operator tool should.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setResult(null);
      try {
        const res = await fetch("/api/admin/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const data: CommandResult = await res.json();
        setResult(data);
        if (data.status === "routed" && data.href) {
          setOpen(false);
          setQuery("");
          router.push(data.href);
        }
      } catch {
        setResult({ status: "error", message: "Couldn't reach the command service." });
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(query);
        }}
      >
        <div className="group relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-slate-500 group-focus-within:text-orange-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Ask Crankcase..."
            aria-label="Ask Crankcase"
            className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-2 pl-9 pr-16 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-3 hidden font-mono text-[10px] text-slate-600 sm:block">
            {busy ? "..." : "⌘K"}
          </span>
        </div>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/98 shadow-2xl shadow-black/60 backdrop-blur">
          {result && (
            <div
              className={`border-b border-slate-800 px-3 py-2.5 text-xs ${
                result.status === "unavailable"
                  ? "text-amber-300"
                  : result.status === "error"
                    ? "text-rose-300"
                    : "text-slate-300"
              }`}
            >
              <p>{result.message}</p>
              {result.detail && <p className="mt-1 text-[11px] text-slate-500">{result.detail}</p>}
            </div>
          )}

          <div className="px-3 pt-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Try one of these
            </span>
          </div>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {EXAMPLES.filter((ex) => ex.label.toLowerCase().includes(query.trim().toLowerCase())).map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(ex.label);
                    void submit(ex.label);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/60 hover:text-white"
                >
                  <span className="truncate">{ex.label}</span>
                  {ex.hint && <span className="shrink-0 font-mono text-[10px] text-slate-600">{ex.hint}</span>}
                </button>
              </li>
            ))}
          </ul>

          <p className="border-t border-slate-800 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
            Natural-language answering is not connected yet. Recognised questions route you to the right
            screen with filters applied; anything else says so rather than guessing.
          </p>
        </div>
      )}
    </div>
  );
}
