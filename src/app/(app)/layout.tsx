import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { auth } from "@/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-800 py-6">
        <div className="mx-auto max-w-5xl px-4 text-xs text-slate-500">
          Crankcase is a personal reference tool. Specs and torque values are
          general starting points, not a replacement for your factory service
          manual. Work safely — use jack stands, eye protection, and your own
          judgment.
        </div>
      </footer>
    </>
  );
}
