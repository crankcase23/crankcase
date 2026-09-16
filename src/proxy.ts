import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple shared-password gate so the site can go on a real, reachable host
// while staying private — nobody without the password gets past this,
// regardless of whether the URL leaks. Works on any host (not tied to a
// specific platform's paid "password protect" feature).
//
// Set SITE_PASSWORD in the environment (Vercel: Project Settings ->
// Environment Variables; locally: .env.local, which is gitignored) to turn
// this on. With no SITE_PASSWORD set, the gate is a no-op — useful for local
// dev — so don't deploy without setting it if the site needs to stay private.
//
// This is a single shared password, not real per-user accounts — fine for
// "keep it private while we build," not a substitute for the real auth
// system planned once accounts/Stripe are built (see build notes).

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    let decoded = "";
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf-8");
    } catch {
      // Malformed header — fall through to the 401 below.
    }
    const suppliedPassword = decoded.slice(decoded.indexOf(":") + 1);
    if (suppliedPassword && suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Crankcase", charset="UTF-8"' },
  });
}

export const config = {
  matcher: [
    // Everything except static assets, PWA icons/manifest, and favicon —
    // those aren't sensitive and gating them just breaks icon loading.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)",
  ],
};
