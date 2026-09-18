import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, adminRoles } from "@/db/schema";
import { requireAdmin, ROLES, type AdminRole } from "@/lib/admin/rbac";
import { recordAudit } from "@/lib/admin/audit";
import { recordError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// User administration actions.
//
// Plain HTML form posts (no client JS needed), redirecting back to the user
// detail page with a result message -- same pattern the existing unlocks
// route already uses.
//
// SECURITY, and this is the important part: every branch independently
// re-checks the specific permission it needs. The UI hides buttons the
// current admin can't use, but hiding a button is not authorization -- a
// hand-crafted POST hits the same checks.
//
// Self-protection: an admin cannot disable or delete their own account, which
// prevents locking the only super admin out of the platform.
// ---------------------------------------------------------------------------

function back(request: Request, userId: string, params: Record<string, string>) {
  const url = new URL(`/admin/users/${userId}`, request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    // Coarse gate FIRST, before touching the database. Without this, an
    // unauthenticated POST with a guessed id would get a 404 for an unknown
    // account and a 403 for a real one -- turning this endpoint into an
    // oracle for whether a given user id exists. Each branch below still
    // re-checks the specific permission it needs.
    const gate = await requireAdmin("users.view");
    if (!gate) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const userId = String(formData.get("userId") ?? "");
    const action = String(formData.get("action") ?? "");

    if (!userId || !action) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    // Load the target once; every branch needs it and it also proves the id is real.
    const targetRows = await db
      .select({ id: users.id, email: users.email, status: users.status, isAdmin: users.isAdmin, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const target = targetRows[0];
    if (!target) return NextResponse.json({ error: "No such account." }, { status: 404 });

    switch (action) {
      // ---------------------------------------------------------------- update
      case "update": {
        const ctx = await requireAdmin("users.edit");
        if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

        const rawName = String(formData.get("name") ?? "").trim();
        const name = rawName.length > 0 ? rawName.slice(0, 120) : null;
        const optOut = formData.get("emailRemindersOptOut") !== null;

        await db.update(users).set({ name, emailRemindersOptOut: optOut }).where(eq(users.id, userId));

        await recordAudit({
          ctx,
          action: "user.update",
          objectType: "user",
          objectId: userId,
          summary: `Updated account ${target.email}`,
          metadata: {
            email: target.email,
            nameFrom: target.name,
            nameTo: name,
            emailRemindersOptOut: optOut,
          },
          request,
        });

        return back(request, userId, { ok: "Account updated." });
      }

      // ------------------------------------------------------- disable/enable
      case "disable":
      case "enable": {
        const ctx = await requireAdmin("users.disable");
        if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

        if (ctx.userId === userId) {
          return back(request, userId, { error: "You cannot change your own account status." });
        }

        const disabling = action === "disable";
        await db
          .update(users)
          .set({
            status: disabling ? "disabled" : "active",
            disabledAt: disabling ? new Date() : null,
            disabledReason: disabling ? String(formData.get("reason") ?? "").slice(0, 300) || null : null,
          })
          .where(eq(users.id, userId));

        await recordAudit({
          ctx,
          action: disabling ? "user.disable" : "user.enable",
          objectType: "user",
          objectId: userId,
          summary: `${disabling ? "Disabled" : "Re-enabled"} account ${target.email}`,
          metadata: { email: target.email },
          request,
        });

        return back(request, userId, {
          ok: disabling
            ? "Account disabled. Sign-in is blocked; all data was kept."
            : "Account re-enabled.",
        });
      }

      // ---------------------------------------------------------------- delete
      case "delete": {
        const ctx = await requireAdmin("users.delete");
        if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

        if (ctx.userId === userId) {
          return back(request, userId, { error: "You cannot delete your own account." });
        }

        // Typed confirmation must match exactly -- a stray click can't destroy
        // an account and its whole service history.
        const confirmEmail = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
        if (confirmEmail !== target.email.toLowerCase()) {
          return back(request, userId, {
            error: "Confirmation email did not match. Nothing was deleted.",
          });
        }

        // Audit BEFORE the delete: the foreign key from admin_audit_log to
        // users is ON DELETE CASCADE on the ADMIN, not the target, so this row
        // survives -- but writing first also means a failed delete still leaves
        // the attempt on record.
        await recordAudit({
          ctx,
          action: "user.delete",
          objectType: "user",
          objectId: userId,
          summary: `Deleted account ${target.email}`,
          metadata: { email: target.email, name: target.name },
          request,
        });

        // Every child table declares ON DELETE CASCADE (garage entries, service
        // entries, odometer readings, unlocks, login events), so this one
        // statement removes the whole record.
        await db.delete(users).where(eq(users.id, userId));

        const url = new URL("/admin/users", request.url);
        url.searchParams.set("ok", `Deleted ${target.email}.`);
        return NextResponse.redirect(url, 303);
      }

      // ------------------------------------------------------------- setRoles
      case "setRoles": {
        const ctx = await requireAdmin("roles.manage");
        if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

        const submitted = formData
          .getAll("roles")
          .map(String)
          .filter((r): r is AdminRole => (ROLES as readonly string[]).includes(r));

        // Guard against an admin stripping their own super_admin and locking
        // the platform's only full-access account out of role management.
        if (ctx.userId === userId && !submitted.includes("super_admin")) {
          return back(request, userId, {
            error: "You cannot remove Super Admin from your own account.",
          });
        }

        const existing = await db
          .select({ role: adminRoles.role })
          .from(adminRoles)
          .where(eq(adminRoles.userId, userId));
        const existingRoles = existing.map((r) => r.role);

        const toAdd = submitted.filter((r) => !existingRoles.includes(r));
        const toRemove = existingRoles.filter((r) => !submitted.includes(r as AdminRole));

        if (toRemove.length > 0) {
          await db
            .delete(adminRoles)
            .where(and(eq(adminRoles.userId, userId), inArray(adminRoles.role, toRemove)));
        }
        if (toAdd.length > 0) {
          await db
            .insert(adminRoles)
            .values(toAdd.map((role) => ({ userId, role, grantedBy: ctx.userId })))
            .onConflictDoNothing();
        }

        if (toAdd.length > 0 || toRemove.length > 0) {
          await recordAudit({
            ctx,
            action: toAdd.length > 0 ? "role.grant" : "role.revoke",
            objectType: "user",
            objectId: userId,
            summary: `Roles for ${target.email} set to ${submitted.join(", ") || "none"}`,
            metadata: { email: target.email, added: toAdd, removed: toRemove, result: submitted },
            request,
          });
        }

        return back(request, userId, { ok: "Roles updated." });
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    await recordError({ source: "api/admin/users", error, path: "/api/admin/users" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
