import { redirect } from "next/navigation";
import { requireAdminUserId } from "@/lib/adminAuth";

// Gates every route under /admin -- Andy's own account/data view, not user
// facing. Anyone signed in but not flagged users.isAdmin (src/db/schema.ts)
// gets bounced to /garage, same as a logged-out visitor to /login on other
// app pages. No nav link anywhere points here on purpose. No wrapper markup
// needed here -- each page under /admin brings its own container.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) redirect("/garage");
  return children;
}
