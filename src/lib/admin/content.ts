import { eq, and, desc, asc, count } from "drizzle-orm";
import { db } from "@/db";
import { contentBlocks } from "@/db/schema";

// Lightweight CMS access layer. Articles, FAQs, announcements and featured
// slots share one table because they share one workflow and one set of SEO
// fields; `kind` keeps them apart.
//
// Repair guides are deliberately NOT here -- see src/lib/admin/guides.ts for
// why guide content stays in version control.

export const CONTENT_KINDS = ["article", "faq", "announcement", "featured"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  article: "Article",
  faq: "FAQ",
  announcement: "Announcement",
  featured: "Featured",
};

export const CONTENT_KIND_HINTS: Record<ContentKind, string> = {
  article: "Long-form page content.",
  faq: "A question and its answer.",
  announcement: "Short, time-sensitive notice.",
  featured: "Promotes a guide or vehicle in a homepage slot — set Target to its id.",
};

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentRow {
  id: string;
  kind: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  imageUrl: string | null;
  targetRef: string | null;
  sortOrder: number;
  publishedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listContent(options: { kind?: ContentKind; status?: ContentStatus } = {}): Promise<ContentRow[]> {
  const conditions = [];
  if (options.kind) conditions.push(eq(contentBlocks.kind, options.kind));
  if (options.status) conditions.push(eq(contentBlocks.status, options.status));

  return db
    .select()
    .from(contentBlocks)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(contentBlocks.kind), asc(contentBlocks.sortOrder), desc(contentBlocks.updatedAt));
}

export async function getContent(id: string): Promise<ContentRow | null> {
  const rows = await db.select().from(contentBlocks).where(eq(contentBlocks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getContentCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: contentBlocks.status, n: count() })
    .from(contentBlocks)
    .groupBy(contentBlocks.status);
  const out: Record<string, number> = { draft: 0, published: 0, archived: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

/** URL-safe slug. Falls back to a timestamp so a title of only symbols still yields one. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `item-${Date.now()}`;
}
