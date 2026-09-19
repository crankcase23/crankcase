"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import CrankcaseBadge from "@/components/CrankcaseBadge";
import CommandBar from "./CommandBar";
import { Icon, type IconName } from "./icons";

// ---------------------------------------------------------------------------
// The persistent admin frame: top bar, left nav, content column.
//
// Desktop: a collapsible rail (full width -> icon-only) whose state persists
// in localStorage, so the operator's preference survives a reload.
// Tablet/mobile: the rail becomes an off-canvas drawer behind a menu button.
//
// This component receives the already-filtered nav list from the server --
// items the current admin lacks permission for are never sent to the client.
// That is a UI nicety, not the security boundary: every page and route
// handler independently calls requireAdmin(permission). See lib/admin/rbac.ts.
// ---------------------------------------------------------------------------

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const STORAGE_KEY = "crankcase:admin:nav-collapsed";

// ---------------------------------------------------------------------------
// The collapsed/expanded preference lives in localStorage, which is an
// external store -- so it's read with useSyncExternalStore rather than an
// effect that calls setState. That avoids the cascading-render pattern React
// warns about, and getServerSnapshot() returning false means the server and
// the first client render agree (expanded), so there's no hydration mismatch.
//
// The snapshot is cached against the raw string it came from: getSnapshot must
// return a stable value when nothing changed, or React re-renders forever.
// (This project has been bitten by exactly that before, in the cart store.)
// A boolean is a primitive, so stability is free once the parse is cached.
// ---------------------------------------------------------------------------

let cachedRaw: string | null = null;
let cachedCollapsed = false;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedCollapsed = raw === "1";
    }
  } catch {
    // Private browsing or blocked storage -- fall back to the last known value.
  }
  return cachedCollapsed;
}

function subscribeCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Non-fatal: the preference just won't persist across reloads.
  }
  cachedRaw = value ? "1" : "0";
  cachedCollapsed = value;
  for (const listener of listeners) listener();
}

export default function AdminShell({
  children,
  navItems,
  adminEmail,
  roleLabel,
  alertCount,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  adminEmail: string;
  roleLabel: string;
  alertCount: number;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeDrawer}
            title={collapsed ? item.label : undefined}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-slate-800/70 text-white"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-100"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-orange-500" />
            )}
            <span className={active ? "text-orange-400" : "text-slate-500 group-hover:text-slate-300"}>
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="ml-auto rounded-full border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
            {collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[calc(100vh-65px)] bg-slate-950">
      {/* ---------------------------------------------------------------- top */}
      <header className="sticky top-[65px] z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open admin navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white lg:hidden"
          >
            <Icon name="menu" className="h-[18px] w-[18px]" />
          </button>

          <span className="hidden items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-orange-300">
              Admin
            </span>
          </span>

          <div className="ml-2 hidden min-w-0 flex-1 md:block lg:max-w-xl">
            <CommandBar />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/admin#attention"
              aria-label={`${alertCount} items need attention`}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white"
            >
              <Icon name="bell" className="h-[18px] w-[18px]" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-bold text-white">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </Link>

            <div className="hidden items-center gap-2 rounded-lg border border-slate-800 py-1 pl-2 pr-1 sm:flex">
              <div className="leading-tight">
                <div className="max-w-[140px] truncate text-[11px] text-slate-300">{adminEmail}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-orange-400/80">
                  {roleLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Log out"
                title="Log out"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Command bar drops below the logo row on small screens */}
        <div className="px-3 pb-2.5 md:hidden">
          <CommandBar />
        </div>
      </header>

      <div className="flex">
        {/* --------------------------------------------------------- side rail */}
        <aside
          className={`sticky top-[122px] hidden h-[calc(100vh-122px)] shrink-0 border-r border-slate-800 bg-slate-950 transition-[width] duration-200 lg:block ${
            collapsed ? "w-[60px]" : "w-[240px]"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t border-slate-800 p-2">
              <button
                type="button"
                onClick={() => writeCollapsed(!collapsed)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-800/40 hover:text-slate-200"
                aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              >
                <Icon
                  name="chevronLeft"
                  className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
                />
                {!collapsed && <span className="text-xs">Collapse</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* ------------------------------------------------------ mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <div className="absolute left-0 top-0 flex h-full w-[240px] flex-col border-r border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
                <CrankcaseBadge className="h-8 w-auto" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white"
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{nav}</div>
              <div className="border-t border-slate-800 px-3 py-3">
                <div className="truncate text-[11px] text-slate-400">{adminEmail}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-orange-400/80">
                  {roleLabel}
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="mt-2 text-xs text-slate-500 hover:text-white"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ content */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
