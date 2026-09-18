import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { contentBlocks } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/rbac";
import { recordAudit, type AuditAction } from "@/lib/admin/audit";
import { recordEvent, EVENT_TYPES } from "@/lib/events";
import { recordError } from "@/lib/errors";
import { CONTENT_KINDS, slugify, type ContentKind } from "@/lib/admin/content";

// CMS write endpoint. Plain form posts, redirecting back with a result.
//
// Authorization is per-action: editing needs "content.edit", publishing needs
// "content.publish", and both are re-checked here rather than inferred from
// which buttons the page happened to render.

function redirectTo(request: Request, path: string, params: Record<string, string>) {
  const url = new URL(path, request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

function str(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value.slice(0, max) : null;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAdmin("content.edit");
    if (!ctx) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const formData = await request.formData();
    const id = String(formData.get("id") ?? "").trim();
    const action = String(formData.get("action") ?? "");
    const isNew = id.length === 0;

    const existing = isNew ? null : (await db.select().from(contentBlocks).where(eq(contentBlocks.id, id)).limit(1))[0];
    if (!isNew && !existing) {
      return NextResponse.json({ error: "No such content item." }, { status: 404 });
    }

    // ------------------------------------------------------------- delete
    if (action === "delete") {
      if (!existing) return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });

      await recordAudit({
        ctx,
        action: "content.delete",
        objectType: "content",
        objectId: existing.id,
        summary: `Deleted ${existing.kind} "${existing.title}"`,
        metadata: { kind: existing.kind, slug: existing.slug, title: existing.title },
        request,
      });

      await db.delete(contentBlocks).where(eq(contentBlocks.id, existing.id));
      return redirectTo(request, "/admin/content", { ok: `Deleted "${existing.title}".` });
    }

    // ------------------------------------------------- archive / unpublish
    if (action === "archive" || action === "unpublish") {
      if (!existing) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
      if (action === "unpublish" && !ctx.permissions.has("content.publish")) {
        return NextResponse.json({ error: "Not authorized to publish or unpublish." }, { status: 403 });
      }

      const nextStatus = action === "archive" ? "archived" : "draft";
      await db
        .update(contentBlocks)
        .set({ status: nextStatus, updatedAt: new Date(), updatedBy: ctx.userId })
        .where(eq(contentBlocks.id, existing.id));

      await recordAudit({
        ctx,
        action: (action === "archive" ? "content.archive" : "content.unpublish") as AuditAction,
        objectType: "content",
        objectId: existing.id,
        summary: `${action === "archive" ? "Archived" : "Unpublished"} ${existing.kind} "${existing.title}"`,
        metadata: { kind: existing.kind, slug: existing.slug, from: existing.status, to: nextStatus },
        request,
      });

      return redirectTo(request, `/admin/content/${existing.id}`, {
        ok: action === "archive" ? "Archived." : "Unpublished — back to draft.",
      });
    }

    // ------------------------------------------------- create / save / publish
    const publishing = action === "publish";
    if (publishing && !ctx.permissions.has("content.publish")) {
      return NextResponse.json({ error: "Not authorized to publish." }, { status: 403 });
    }

    const title = str(formData, "title", 200);
    if (!title) {
      return redirectTo(request, isNew ? "/admin/content/new" : `/admin/content/${id}`, {
        error: "A title is required.",
      });
    }

    const rawKind = String(formData.get("kind") ?? "article");
    const kind: ContentKind = (CONTENT_KINDS as readonly string[]).includes(rawKind)
      ? (rawKind as ContentKind)
      : "article";

    const slug = slugify(str(formData, "slug", 80) ?? title);

    // Slugs are unique across the table -- catch the collision here and say so
    // rather than letting the database throw a constraint error into a 500.
    const clash = await db
      .select({ id: contentBlocks.id })
      .from(contentBlocks)
      .where(isNew ? eq(contentBlocks.slug, slug) : and(eq(contentBlocks.slug, slug), ne(contentBlocks.id, id)))
      .limit(1);
    if (clash.length > 0) {
      return redirectTo(request, isNew ? "/admin/content/new" : `/admin/content/${id}`, {
        error: `The slug "${slug}" is already in use. Choose a different one.`,
      });
    }

    const sortOrderRaw = Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10);
    const values = {
      kind,
      slug,
      title,
      excerpt: str(formData, "excerpt", 400),
      body: str(formData, "body", 100000),
      seoTitle: str(formData, "seoTitle", 120),
      seoDescription: str(formData, "seoDescription", 300),
      imageUrl: str(formData, "imageUrl", 500),
      targetRef: str(formData, "targetRef", 120),
      sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
      status: publishing ? "published" : existing?.status === "published" ? "draft" : (existing?.status ?? "draft"),
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    if (isNew) {
      const newId = randomUUID();
      await db.insert(contentBlocks).values({
        ...values,
        id: newId,
        createdBy: ctx.userId,
        publishedAt: publishing ? new Date() : null,
      });

      await recordAudit({
        ctx,
        action: publishing ? "content.publish" : "content.create",
        objectType: "content",
        objectId: newId,
        summary: `${publishing ? "Published" : "Created"} ${kind} "${title}"`,
        metadata: { kind, slug, title },
        request,
      });

      if (publishing) {
        await recordEvent({
          type: EVENT_TYPES.CONTENT_PUBLISHED,
          userId: ctx.userId,
          objectType: "content",
          objectId: newId,
          metadata: { kind, slug },
        });
      }

      return redirectTo(request, `/admin/content/${newId}`, {
        ok: publishing ? "Created and published." : "Saved as draft.",
      });
    }

    await db
      .update(contentBlocks)
      .set({
        ...values,
        publishedAt: publishing ? (existing!.publishedAt ?? new Date()) : existing!.publishedAt,
      })
      .where(eq(contentBlocks.id, id));

    await recordAudit({
      ctx,
      action: publishing ? "content.publish" : "content.update",
      objectType: "content",
      objectId: id,
      summary: `${publishing ? "Published" : "Updated"} ${kind} "${title}"`,
      metadata: { kind, slug, title, previousStatus: existing!.status },
      request,
    });

    if (publishing && existing!.status !== "published") {
      await recordEvent({
        type: EVENT_TYPES.CONTENT_PUBLISHED,
        userId: ctx.userId,
        objectType: "content",
        objectId: id,
        metadata: { kind, slug },
      });
    }

    return redirectTo(request, `/admin/content/${id}`, {
      ok: publishing ? "Published." : "Saved.",
    });
  } catch (error) {
    await recordError({ source: "api/admin/content", error, path: "/api/admin/content" });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
