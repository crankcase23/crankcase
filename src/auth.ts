import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "node:crypto";
import { verifyPassword } from "@/lib/users";
import { db } from "@/db";
import { users, loginEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

// Credentials-only, JWT sessions -- deliberately no database adapter (that's
// really only needed for OAuth account-linking). We check the password
// ourselves against our own `users` table (src/db/schema.ts) and mint a JWT;
// no separate accounts/sessions tables to maintain.
export const { handlers, signIn, signOut, auth } = NextAuth({
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
        return { id: user.id, email: user.email };
      },
    }),
    ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
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
