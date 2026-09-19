import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminTasks } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { createTask, TASK_CATEGORIES } from "@/lib/admin/todo";
import { recordError } from "@/lib/errors";

// Manual task CRUD for the To-Do page. Plain form posts, redirect back.
//
// Authorization is checked before anything is read from the database, so this
// can't be used to probe whether a task id exists.
//
// Not audited: these are the admin's own scratch notes, not actions against
// user data. The audit log is for things that affect accounts, access,
// content and money -- filling it with "ticked off a to-do" would bury the
// entries that matter.

function back(request: Request, params: Record<string, string> = {}) {
  const url = new URL("/admin/todo", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.hash = "tasks";
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("todo.manage");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const action = String(formData.get("action") ?? "");
    const id = String(formData.get("id") ?? "");

    if (action === "create") {
      const title = String(formData.get("title") ?? "").trim();
      if (!title) return back(request, { error: "A title is required." });

      const rawCategory = String(formData.get("category") ?? "product");
      const category = (TASK_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : "product";

      const rawPriority = Number.parseInt(String(formData.get("priority") ?? "100"), 10);
      const detail = String(formData.get("detail") ?? "").trim();

      await createTask({
        title: title.slice(0, 200),
        detail: detail ? detail.slice(0, 1000) : null,
        category,
        priority: Number.isFinite(rawPriority) ? rawPriority : 100,
        createdBy: ctx.userId,
      });

      return back(request, { ok: "Task added." });
    }

    if (!id) return back(request, { error: "Missing task." });

    if (action === "complete" || action === "reopen") {
      const done = action === "complete";
      await db
        .update(adminTasks)
        .set({
          status: done ? "done" : "open",
          completedAt: done ? new Date() : null,
          completedBy: done ? ctx.userId : null,
          updatedAt: new Date(),
        })
        .where(eq(adminTasks.id, id));
      return back(request, { ok: done ? "Marked done." : "Reopened." });
    }

    if (action === "delete") {
      await db.delete(adminTasks).where(eq(adminTasks.id, id));
      return back(request, { ok: "Task removed." });
    }

    return back(request, { error: "Unknown action." });
  } catch (error) {
    await recordError({ source: "api/admin/tasks", error, path: "/api/admin/tasks" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
