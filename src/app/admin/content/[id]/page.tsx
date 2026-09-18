import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/rbac";
import {
  getContent,
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  CONTENT_KIND_HINTS,
  type ContentKind,
} from "@/lib/admin/content";
import { formatDateTime, relativeTime } from "@/lib/admin/format";
import { Panel, Badge, FieldList, MicroLabel, AdminButton } from "@/components/admin/ui";

export const metadata = { title: "Edit content" };

// One page handles both create and edit: /admin/content/new falls through to
// this dynamic segment with id === "new". Keeps the form in a single place so
// the two paths can never drift apart.
export default async function AdminContentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const ctx = await requireAdmin("content.view");
  if (!ctx) redirect("/admin");

  const { id } = await params;
  const { error, ok } = await searchParams;
  const isNew = id === "new";

  const content = isNew ? null : await getContent(id);
  if (!isNew && !content) notFound();

  const canEdit = ctx.permissions.has("content.edit");
  const canPublish = ctx.permissions.has("content.publish");

  if (isNew && !canEdit) redirect("/admin/content");

  const field =
    "w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none disabled:opacity-60";

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/content" className="text-xs text-slate-500 hover:text-orange-300">
          ← All content
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <MicroLabel>{isNew ? "New item" : CONTENT_KIND_LABELS[content!.kind as ContentKind] ?? content!.kind}</MicroLabel>
          <h1
            className="mt-1 truncate text-2xl font-bold tracking-wide text-slate-50 sm:text-3xl"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}
          >
            {isNew ? "CREATE CONTENT" : content!.title}
          </h1>
          {!isNew && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  content!.status === "published" ? "positive" : content!.status === "draft" ? "warning" : "muted"
                }
              >
                {content!.status}
              </Badge>
              <span className="font-mono text-[11px] text-slate-600">/{content!.slug}</span>
            </div>
          )}
        </div>
      </div>

      {ok && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {decodeURIComponent(ok)}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action="/api/admin/content" method="post">
        <input type="hidden" name="id" value={isNew ? "" : content!.id} />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* ---------------------------------------------------------- body */}
          <div className="space-y-4">
            <Panel title="Content" eyebrow="Body" accent>
              <div className="space-y-3">
                <div>
                  <label htmlFor="kind" className="mb-1 block">
                    <MicroLabel>Type</MicroLabel>
                  </label>
                  <select
                    id="kind"
                    name="kind"
                    defaultValue={content?.kind ?? "article"}
                    disabled={!canEdit}
                    className={field}
                  >
                    {CONTENT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {CONTENT_KIND_LABELS[k]} — {CONTENT_KIND_HINTS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="title" className="mb-1 block">
                    <MicroLabel>Title *</MicroLabel>
                  </label>
                  <input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={content?.title ?? ""}
                    disabled={!canEdit}
                    className={field}
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="mb-1 block">
                    <MicroLabel>Slug</MicroLabel>
                  </label>
                  <input
                    id="slug"
                    name="slug"
                    maxLength={80}
                    placeholder="auto-generated from the title"
                    defaultValue={content?.slug ?? ""}
                    disabled={!canEdit}
                    className={`${field} font-mono text-xs`}
                  />
                </div>

                <div>
                  <label htmlFor="excerpt" className="mb-1 block">
                    <MicroLabel>Excerpt</MicroLabel>
                  </label>
                  <textarea
                    id="excerpt"
                    name="excerpt"
                    rows={2}
                    maxLength={400}
                    defaultValue={content?.excerpt ?? ""}
                    disabled={!canEdit}
                    className={field}
                  />
                </div>

                <div>
                  <label htmlFor="body" className="mb-1 block">
                    <MicroLabel>Body</MicroLabel>
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={14}
                    defaultValue={content?.body ?? ""}
                    disabled={!canEdit}
                    className={`${field} font-mono text-xs leading-relaxed`}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="SEO & media" eyebrow="Metadata">
              <div className="space-y-3">
                <div>
                  <label htmlFor="seoTitle" className="mb-1 block">
                    <MicroLabel>SEO title</MicroLabel>
                  </label>
                  <input
                    id="seoTitle"
                    name="seoTitle"
                    maxLength={120}
                    defaultValue={content?.seoTitle ?? ""}
                    disabled={!canEdit}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="seoDescription" className="mb-1 block">
                    <MicroLabel>SEO description</MicroLabel>
                  </label>
                  <textarea
                    id="seoDescription"
                    name="seoDescription"
                    rows={2}
                    maxLength={300}
                    defaultValue={content?.seoDescription ?? ""}
                    disabled={!canEdit}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="imageUrl" className="mb-1 block">
                    <MicroLabel>Image URL</MicroLabel>
                  </label>
                  <input
                    id="imageUrl"
                    name="imageUrl"
                    type="url"
                    maxLength={500}
                    placeholder="https://..."
                    defaultValue={content?.imageUrl ?? ""}
                    disabled={!canEdit}
                    className={field}
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    There is no upload store in this app — reference an image already served from the site or a CDN.
                  </p>
                </div>
                <div>
                  <label htmlFor="targetRef" className="mb-1 block">
                    <MicroLabel>Target reference</MicroLabel>
                  </label>
                  <input
                    id="targetRef"
                    name="targetRef"
                    maxLength={120}
                    placeholder="guide or vehicle id, for Featured items"
                    defaultValue={content?.targetRef ?? ""}
                    disabled={!canEdit}
                    className={`${field} font-mono text-xs`}
                  />
                </div>
              </div>
            </Panel>
          </div>

          {/* --------------------------------------------------------- rail */}
          <div className="space-y-4">
            <Panel title="Publish" eyebrow="Workflow" accent>
              <div className="space-y-3">
                <div>
                  <label htmlFor="sortOrder" className="mb-1 block">
                    <MicroLabel>Sort order</MicroLabel>
                  </label>
                  <input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    defaultValue={content?.sortOrder ?? 0}
                    disabled={!canEdit}
                    className={field}
                  />
                </div>

                {canEdit && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <AdminButton variant="secondary" name="action" value="saveDraft">
                      Save as draft
                    </AdminButton>
                    {canPublish && (
                      <AdminButton variant="primary" name="action" value="publish">
                        {content?.status === "published" ? "Save & keep live" : "Publish"}
                      </AdminButton>
                    )}
                  </div>
                )}

                {!canEdit && (
                  <p className="text-[11px] text-slate-500">
                    Your role can view content but not edit it.
                  </p>
                )}
              </div>
            </Panel>

            {!isNew && canEdit && (
              <Panel title="Status actions" eyebrow="Change state">
                <div className="flex flex-wrap gap-2">
                  {canPublish && content!.status === "published" && (
                    <AdminButton variant="secondary" name="action" value="unpublish">
                      Unpublish
                    </AdminButton>
                  )}
                  {content!.status !== "archived" && (
                    <AdminButton variant="secondary" name="action" value="archive">
                      Archive
                    </AdminButton>
                  )}
                  <AdminButton variant="danger" name="action" value="delete">
                    Delete
                  </AdminButton>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                  Archiving keeps the record and its history. Deleting removes it permanently. Both are written to the
                  audit log.
                </p>
              </Panel>
            )}

            {!isNew && (
              <Panel title="Record" eyebrow="History">
                <FieldList
                  rows={[
                    { label: "Created", value: formatDateTime(content!.createdAt) },
                    { label: "Last modified", value: relativeTime(content!.updatedAt) },
                    {
                      label: "Published",
                      value: content!.publishedAt ? (
                        formatDateTime(content!.publishedAt)
                      ) : (
                        <span className="text-slate-600">never</span>
                      ),
                    },
                    {
                      label: "ID",
                      value: <span className="font-mono text-[11px] text-slate-500">{content!.id}</span>,
                    },
                  ]}
                />
              </Panel>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
