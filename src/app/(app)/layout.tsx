import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

let isAdmin = false;
  if (session.user.id) {
    const rows = await db.select().from(users).where(eq(users.id, session.user.id));
    isAdmin = rows[0]?.isAdmin ?? false;
  }

return (
  
<>
  <Header isAdmin={isAdmin} />
  <main className="flex-1">{children}</main>
  <footer className="border-t border-slate-800 py-6">
  <div className="mx-auto max-w-5xl px-4 text-xs text-slate-500">
  Crankcase Garage is a personal reference tool. Specs and torque values are
  general starting points, not a replacement for your factory service
  manual. Work safely — use jack stands, eye protection, and your own
  judgment.
  </div></footer>
</>
  );
}
