"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import CrankcaseBadge from "@/components/CrankcaseBadge";
import { useCartCount } from "@/lib/cart";

/**
 * The one header the whole site wears. Marketing pages, the signed-in app, and
 * the admin command center all render this same bar.
 *
 * It exists because there used to be two separate headers, and the swag store
 * was unreachable from anywhere behind the login: the app header carried only
 * My Garage, VIN Lookup and Log out, and its badge pointed at /garage, so a
 * signed-in visitor had no route back to the marketing side short of typing a
 * URL. Every nav link now lives in exactly one file.
 *
 * Two rules this component exists to enforce:
 *
 *   1. The badge always goes to "/". Signed out, signed in, admin, any page.
 *   2. Every tab renders on every page. Tabs behind the login still show when
 *      signed out -- the route's own guard sends the visitor to /login, which
 *      is a better answer than hiding the tab and pretending the feature is
 *      not there.
 *
 * HEIGHT IS LOAD-BEARING. The bar is sticky, h-16 (64px) plus a 1px bottom
 * border, so it occupies 65px. AdminShell stacks its own sticky header directly
 * beneath it and hardcodes that number. Change the height here and you must
 * change AdminShell to match: its header (top-[65px]), its side rail
 * (top-[122px] / h-[calc(100vh-122px)]), and its root min-height.
 */

type Tab = {
  href: string;
  label: string;
  /** Extra path roots that should light this tab up, e.g. /vehicles for My Garage. */
  match?: string[];
  /** The cart tab appends a live item count to its label. */
  cart?: boolean;
};

const TABS: Tab[] = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/swag", label: "Swag" },
  { href: "/cart", label: "Cart", cart: true },
  { href: "/garage", label: "My Garage", match: ["/garage", "/vehicles"] },
  { href: "/decode", label: "VIN Lookup" },
];

export default function SiteHeader({
  isAuthed = false,
  isAdmin = false,
  wide = false,
}: {
  isAuthed?: boolean;
  isAdmin?: boolean;
  /** Admin pages run to max-w-[1400px]; everything else is max-w-6xl. */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const cartCount = useCartCount();

  const shell = wide ? "max-w-[1400px]" : "max-w-6xl";

  function isActive(tab: Tab) {
    const roots = tab.match ?? [tab.href];
    return roots.some((root) => pathname === root || pathname.startsWith(root + "/"));
  }

  function labelFor(tab: Tab) {
    return tab.cart && cartCount > 0 ? `${tab.label} (${cartCount})` : tab.label;
  }

  function tabClass(tab: Tab) {
    return isActive(tab)
      ? "font-semibold text-orange-400"
      : "text-slate-300 hover:text-white";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className={`mx-auto flex h-16 items-center gap-4 px-4 ${shell}`}>
        <Link
          href="/"
          aria-label="Crankcase Garage home"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center"
        >
          <CrankcaseBadge className="h-10 w-auto" />
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="hidden shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 sm:inline-block"
          >
            Admin
          </Link>
        )}

        <nav className="ml-auto hidden items-center gap-5 text-sm lg:flex">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tabClass(tab)}>
              {labelFor(tab)}
            </Link>
          ))}

          {isAuthed ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-slate-500 hover:text-white"
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className="text-slate-300 hover:text-white">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-400"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white lg:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-800 bg-slate-950 lg:hidden">
          <div className={`mx-auto flex flex-col gap-3 px-4 py-4 text-sm ${shell}`}>
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                className={tabClass(tab)}
              >
                {labelFor(tab)}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="text-amber-400 hover:text-amber-300"
              >
                Admin
              </Link>
            )}

            {isAuthed ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="text-left text-slate-500 hover:text-white"
              >
                Log out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-slate-300 hover:text-white"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-center font-semibold text-slate-950 hover:bg-orange-400"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
