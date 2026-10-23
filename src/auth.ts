import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "node:crypto";
import { verifyPassword } from "@/lib/users";
import { authLogger } from "@/lib/authLogger";
import { db } from "@/db";
import { users, loginEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { createSessionCallbacks, passwordVersion } from "@/lib/sessionGuard";

// Credentials-only, JWT sessions -- deliberately no database adapter (that's
// really only needed for OAuth account-linking). We check the password
// ourselves against our own `users` table (src/db/schema.ts) and mint a JWT;
// no separate accounts/sessions tables to maintain.
const nextAuth = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }
        const user = await verifyPassword(email, password);
        if (!user) return null;
        // `pwv` is the password-version stamp (src/lib/sessionGuard.ts): it ties this session to the current password.
        return { id: user.id, email: user.email, pwv: passwordVersion(user.passwordHash) };
      },
    }),
    ],
  session: { strategy: "jwt" },
  logger: authLogger,
  pages: { signIn: "/login" },
  // Re-checks the account on every session decode (disabled, deleted, password changed, no stamp). See sessionGuard.ts.
  callbacks: createSessionCallbacks() as never,
  events: {
    // Fires after a successful sign-in (credentials only here). Powers the
  // admin "login history" view (src/app/admin) -- lastLoginAt for the
  // quick column, loginEvents for the full per-user log.
  async signIn({ user }) {
    if (!user.id) return;
    await Promise.all([
      db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
      db.insert(loginEvents).values({ id: randomUUID(), userId: user.id }),
      ]);
  },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * The signed-in session, or null. Wraps Auth.js's auth() so that a session with no user (what the session callback returns
 * while the account cannot be verified, see sessionGuard.ts) is null for EVERY caller, including the ones that only test
 * truthiness. Every caller in this codebase uses the no-argument form.
 */
export async function auth(): Promise<Session | null> {
  const session = await nextAuth.auth();
  return session?.user?.id ? session : null;
}
