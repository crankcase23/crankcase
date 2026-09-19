// Crankcase sync backend -- see build notes "Cross-device sync & iOS app
// plan" for why this exists and what it replaces (the localStorage-only
// garage/service-history/odometer hooks in src/lib/*.ts).
//
// Drizzle ORM, not Prisma -- this sandbox's egress policy blocks Prisma's
// binary query-engine downloads (binaries.prisma.sh), and Drizzle is pure
// TypeScript with no native binaries to fetch, so it sidesteps that
// entirely. Works the same way against Postgres on Vercel.

import {
      pgTable,
      text,
      integer,
      boolean,
      timestamp,
      primaryKey,
      jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
      id: text("id").primaryKey(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash").notNull(),
      // Maintenance-reminder emails (src/app/api/cron/maintenance-reminders) are
      // on by default; this is a plain opt-out flag flipped by the one-click
      // unsubscribe link (src/app/api/account/unsubscribe) or the toggle at
      // /account. No separate consent/verification needed like SMS would
      // require -- it's the same address they log in with.
      emailRemindersOptOut: boolean("email_reminders_opt_out").notNull().default(false),
      // Gates access to /admin (src/lib/adminAuth.ts). Flipped by hand in the DB
      // for Andy's own account -- there's no UI to grant this, on purpose.
      isAdmin: boolean("is_admin").notNull().default(false),
      // Display name. Signup has never collected one, so this is null for
      // every existing account; /admin can set it, and the UI falls back to
      // the email's local part. Added 2026-09-18 with the admin command center.
      name: text("name"),
      // "active" | "disabled". Disabled accounts still exist (and keep their
      // data) but are refused at sign-in by src/auth.ts. Defaults to active so
      // every pre-existing row keeps working exactly as before.
      status: text("status").notNull().default("active"),
      disabledAt: timestamp("disabled_at"),
      disabledReason: text("disabled_reason"),
      // Set by the events.signIn hook in src/auth.ts on every successful login.
      // Nullable -- accounts created before this shipped have never had a login
      // recorded until they sign in again. See loginEvents below for full history.
      lastLoginAt: timestamp("last_login_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Mirrors src/types/garage.ts's GarageEntry union: a "catalog" row
// references a vehicle id from src/data (specs/torque live in code, not
// the DB); a "custom" row carries its own year/make/model/trim/engine
// since we have no curated data for it.
export const garageEntries = pgTable("garage_entries", {
      id: text("id").primaryKey(),
      userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      kind: text("kind").notNull(), // "catalog" | "custom"
      vehicleId: text("vehicle_id"), // set when kind = "catalog"
      year: text("year"),
      make: text("make"),
      model: text("model"),
      trim: text("trim"),
      engine: text("engine"),
      vin: text("vin"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// garageEntryId here plays the same role the old localStorage keys did
// (crankcase:service-history:<vehicleId>) -- one vehicle's service log.
export const serviceEntries = pgTable("service_entries", {
      id: text("id").primaryKey(),
      userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      garageEntryId: text("garage_entry_id")
      .notNull()
      .references(() => garageEntries.id, { onDelete: "cascade" }),
      date: text("date").notNull(),
      mileage: integer("mileage").notNull(),
      title: text("title").notNull(),
      guideId: text("guide_id"), // set when picked from this vehicle's guide list
      notes: text("notes"),
      loggedAt: timestamp("logged_at").notNull().defaultNow(),
});

// One odometer reading per garage entry, same shape as the old
// crankcase:odometer:<vehicleId> localStorage key.
export const odometerReadings = pgTable(
      "odometer_readings",
      {
            garageEntryId: text("garage_entry_id")
            .notNull()
            .references(() => garageEntries.id, { onDelete: "cascade" }),
            userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
            miles: integer("miles").notNull(),
            updatedAt: timestamp("updated_at").notNull().defaultNow(),
      },
      (table) => ({
            pk: primaryKey({ columns: [table.garageEntryId] }),
      }),
      );
// Cache of real Open Labor Project data for vehicles that AREN'T one of our
// hand-curated catalog entries (src/data/vehicles.ts) -- i.e. anything a user
// added via VIN decode or the manual "add a vehicle" form. Keyed by a
// normalized make/model/year/engine string (see src/lib/vehicleDataCache.ts)
// so the same real-world car is only ever looked up from the API once,
// forever -- precious given Open Labor Project's free tier is a shared
// 10-requests/day cap across every user of this app, not per-user.
//
// status:
// "pending" -- never successfully fetched yet (may have failed/been
// quota-limited on a prior attempt; safe to retry later)
// "ok" -- fluids has real data, safe to render
// "not_found" -- Open Labor Project has no data for this vehicle; don't
// keep re-asking on every page load, but do allow a retry
// after some time in case their database grows
export const vehicleDataCache = pgTable("vehicle_data_cache", {
      cacheKey: text("cache_key").primaryKey(),
      make: text("make").notNull(),
      model: text("model").notNull(),
      year: text("year").notNull(),
      engine: text("engine"),
      status: text("status").notNull().default("pending"),
      fluids: jsonb("fluids"),
      rawResponse: jsonb("raw_response"),
      source: text("source"), // "open-labor-project"
      confidence: text("confidence"),
      attempts: integer("attempts").notNull().default(0),
      lastAttemptAt: timestamp("last_attempt_at"),
      fetchedAt: timestamp("fetched_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tracks which (garageEntryId, maintenance item key) combos have already
// triggered a reminder email at their current status, so the daily cron
// (src/app/api/cron/maintenance-reminders) only emails when something newly
// crosses into "due-soon" or "overdue" instead of re-sending the same nag
// every day it stays that way. See src/lib/reminders.ts for the item keys
// and statuses this references.
export const reminderNotifications = pgTable(
      "reminder_notifications",
      {
            garageEntryId: text("garage_entry_id")
            .notNull()
            .references(() => garageEntries.id, { onDelete: "cascade" }),
            itemKey: text("item_key").notNull(), // MaintenanceItem.key from src/lib/reminders.ts
            status: text("status").notNull(), // ReminderStatus last notified for
            notifiedAt: timestamp("notified_at").notNull().defaultNow(),
      },
      (table) => ({
            pk: primaryKey({ columns: [table.garageEntryId, table.itemKey] }),
      }),
      );

// One row per (user, vehicle) that has premium access -- either paid for
// (once Stripe/checkout exists -- not built yet) or comped by Andy via the
// /admin dashboard (src/app/admin). Presence of a row = unlocked; there's
// no boolean to flip, just insert/delete. NOT enforced anywhere yet (no
// paywall exists -- premium guides/Service History still render in full
// for everyone) -- this table exists so admin gifting has somewhere real to
// write to, ready for when enforcement ships.
export const vehicleUnlocks = pgTable(
      "vehicle_unlocks",
      {
            userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
            garageEntryId: text("garage_entry_id")
            .notNull()
            .references(() => garageEntries.id, { onDelete: "cascade" }),
            source: text("source").notNull(), // "gift" | "purchase"
            grantedAt: timestamp("granted_at").notNull().defaultNow(),
      },
      (table) => ({
            pk: primaryKey({ columns: [table.userId, table.garageEntryId] }),
      }),
      );

// One row per successful sign-in, purely for the admin "login history" view
// (src/app/admin) -- recorded via NextAuth's events.signIn hook in
// src/auth.ts. users.lastLoginAt (most recent only) is cheaper to query for
// the main admin list; this table backs the full per-user history.
export const loginEvents = pgTable("login_events", {
      id: text("id").primaryKey(),
      userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      loggedInAt: timestamp("logged_in_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Admin command center (added 2026-09-18)
//
// Everything below backs /admin. Nothing here is user-facing; the existing
// tables above are untouched except for two additive nullable/defaulted
// columns on `users` (name, status) further down in the migration notes.
// ---------------------------------------------------------------------------

// Append-only record of every administrative action. Written by
// src/lib/admin/audit.ts -- never updated or deleted from the app. Read by
// /admin/security. `metadata` holds action-specific context (old/new values,
// reason, target email) so the log stays useful without a join per row.
export const adminAuditLog = pgTable("admin_audit_log", {
      id: text("id").primaryKey(),
      adminUserId: text("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      action: text("action").notNull(), // e.g. "user.disable", "unlock.grant", "content.publish"
      objectType: text("object_type"), // "user" | "garage_entry" | "content" | "guide" | ...
      objectId: text("object_id"),
      summary: text("summary"), // one-line human description rendered in the log
      metadata: jsonb("metadata"),
      ip: text("ip"),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Role grants for admin accounts. users.isAdmin remains the master switch
// (an account with isAdmin=false can never reach /admin regardless of rows
// here); this table decides WHAT an admin may do once inside. An admin with
// no row is treated as SUPPORT_ADMIN (least privilege) -- see
// src/lib/admin/rbac.ts. Andy's own account should get a super_admin row.
export const adminRoles = pgTable(
      "admin_roles",
      {
            userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
            role: text("role").notNull(), // "super_admin" | "content_admin" | "support_admin" | "analytics_admin"
            grantedBy: text("granted_by"),
            grantedAt: timestamp("granted_at").notNull().defaultNow(),
      },
      (table) => ({
            pk: primaryKey({ columns: [table.userId, table.role] }),
      }),
      );

// Generic first-party event stream -- the single source for the Command
// Center activity feed, the Analytics section, and the funnel. Deliberately
// one wide table rather than a table per event type: the admin UI always
// queries it the same way (filter by type/date, order by createdAt) and a
// single well-indexed append-only table scales to millions of rows fine.
//
// No third-party analytics provider is involved; nothing leaves the
// database. `userId` is null for anonymous/logged-out events.
export const appEvents = pgTable("app_events", {
      id: text("id").primaryKey(),
      type: text("type").notNull(), // see EVENT_TYPES in src/lib/events.ts
      userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
      objectType: text("object_type"), // "vehicle" | "guide" | "garage_entry" | ...
      objectId: text("object_id"),
      path: text("path"), // request path, when the event is a page/guide view
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Application errors captured by src/lib/errors.ts. This is the "glitches"
// visibility Andy asked for, kept first-party so it needs no Sentry account
// or DSN. Rows are grouped in the UI by `fingerprint` (a stable hash of
// source+message) so one recurring bug is one line, not five hundred.
export const errorEvents = pgTable("error_events", {
      id: text("id").primaryKey(),
      fingerprint: text("fingerprint").notNull(),
      level: text("level").notNull().default("error"), // "warning" | "error" | "fatal"
      source: text("source").notNull(), // route / module that threw
      message: text("message").notNull(),
      stack: text("stack"),
      path: text("path"),
      userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
      status: text("status").notNull().default("open"), // "open" | "resolved" | "ignored"
      metadata: jsonb("metadata"),
      resolvedAt: timestamp("resolved_at"),
      resolvedBy: text("resolved_by"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Commerce tables -- SCHEMA ONLY, NOTHING WRITES TO THESE YET.
//
// There is no Stripe integration and no checkout in this app (see build
// notes: "don't build Stripe without asking first"). These exist so the
// Revenue section is built against a real shape rather than invented
// numbers -- every query in /admin/revenue runs against these tables today
// and correctly returns zero rows, which the UI renders as "Waiting for
// data". When payments ship, the provider webhook writes here and the whole
// section lights up with no UI rework.
// ---------------------------------------------------------------------------

// A one-time purchase -- today that means a per-vehicle premium unlock, the
// paid counterpart to the `gift` rows in vehicleUnlocks above.
export const purchases = pgTable("purchases", {
      id: text("id").primaryKey(),
      userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      garageEntryId: text("garage_entry_id").references(() => garageEntries.id, { onDelete: "set null" }),
      vehicleId: text("vehicle_id"), // catalog vehicle id, kept denormalized so revenue-by-vehicle survives a garage delete
      guideId: text("guide_id"), // set if we ever sell a single guide rather than a whole vehicle
      description: text("description"),
      amountCents: integer("amount_cents").notNull(),
      refundedCents: integer("refunded_cents").notNull().default(0),
      currency: text("currency").notNull().default("usd"),
      status: text("status").notNull(), // "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded"
      provider: text("provider"), // "stripe" | ...
      providerRef: text("provider_ref"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A recurring plan. Nothing sells subscriptions today; MRR/churn in
// /admin/revenue are computed from this table and read zero until it fills.
export const subscriptions = pgTable("subscriptions", {
      id: text("id").primaryKey(),
      userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
      plan: text("plan").notNull(),
      status: text("status").notNull(), // "active" | "trialing" | "past_due" | "canceled"
      priceCents: integer("price_cents").notNull(),
      currency: text("currency").notNull().default("usd"),
      interval: text("interval").notNull().default("month"), // "month" | "year"
      provider: text("provider"),
      providerRef: text("provider_ref"),
      currentPeriodStart: timestamp("current_period_start"),
      currentPeriodEnd: timestamp("current_period_end"),
      cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
      canceledAt: timestamp("canceled_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payment-provider event log (charges, failures, refunds, disputes). Drives
// the "Failed payments" alert on the Command Center once a provider exists.
export const paymentEvents = pgTable("payment_events", {
      id: text("id").primaryKey(),
      type: text("type").notNull(), // "payment_succeeded" | "payment_failed" | "refund" | "dispute" | ...
      userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
      purchaseId: text("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
      subscriptionId: text("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
      amountCents: integer("amount_cents"),
      currency: text("currency").notNull().default("usd"),
      status: text("status"), // provider status string
      message: text("message"),
      provider: text("provider"),
      providerRef: text("provider_ref"),
      resolvedAt: timestamp("resolved_at"), // set when an admin clears a failed payment
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Lightweight CMS: articles, FAQs, announcements and homepage/featured
// slots all share one table because they share one editorial workflow
// (draft -> published -> archived) and one set of SEO fields. `kind` keeps
// them apart; `body` is markdown-ish plain text rendered by the consumer.
//
// NOTE: repair guides deliberately do NOT live here. Guide content stays in
// src/data/repairs.ts under version control -- /admin/guides is a read-only
// console over that code plus a publish-readiness validator. See
// src/lib/admin/guides.ts for why.
export const contentBlocks = pgTable("content_blocks", {
      id: text("id").primaryKey(),
      kind: text("kind").notNull(), // "article" | "faq" | "announcement" | "featured"
      slug: text("slug").notNull().unique(),
      title: text("title").notNull(),
      excerpt: text("excerpt"),
      body: text("body"),
      status: text("status").notNull().default("draft"), // "draft" | "published" | "archived"
      seoTitle: text("seo_title"),
      seoDescription: text("seo_description"),
      imageUrl: text("image_url"),
      targetRef: text("target_ref"), // e.g. a guide/vehicle id for "featured" rows
      sortOrder: integer("sort_order").notNull().default(0),
      publishedAt: timestamp("published_at"),
      createdBy: text("created_by"),
      updatedBy: text("updated_by"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// To-Do / feedback (added 2026-09-18)
// ---------------------------------------------------------------------------

// User-submitted feedback from the widget on guide and vehicle pages. This is
// the highest-signal table in the app: a DIY user telling you a torque spec
// looks wrong matters more than any metric on the dashboard, because being
// wrong about a torque value is how someone strips a bolt.
//
// Captured context (path, vehicle, guide) is filled in automatically from
// wherever they were, so the report is actionable without a back-and-forth.
export const feedback = pgTable("feedback", {
      id: text("id").primaryKey(),
      userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
      // "bug" | "data" | "idea" | "other" -- "data" means "this number looks
      // wrong", which is the category that gets triaged first.
      kind: text("kind").notNull().default("other"),
      message: text("message").notNull(),
      path: text("path"),
      vehicleId: text("vehicle_id"), // catalog vehicle id, when reported from one
      guideId: text("guide_id"), // repair guide id, when reported from one
      // "new" | "triaged" | "resolved" | "wontfix"
      status: text("status").notNull().default("new"),
      // Set by an admin during triage, not by the reporter -- users are bad at
      // rating their own severity and it isn't their job.
      severity: text("severity"), // "low" | "medium" | "high"
      adminNote: text("admin_note"),
      resolvedBy: text("resolved_by"),
      resolvedAt: timestamp("resolved_at"),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Manual admin to-do items, sitting alongside the derived signals on
// /admin/todo. Deliberately simple: the derived half of that page is the part
// that can never go stale, and this half exists for the things no query can
// infer. Keeping it small is the point -- a heavyweight task system here would
// just become another doc that drifts.
export const adminTasks = pgTable("admin_tasks", {
      id: text("id").primaryKey(),
      title: text("title").notNull(),
      detail: text("detail"),
      // "content" | "data" | "product" | "ops"
      category: text("category").notNull().default("product"),
      // "open" | "doing" | "done"
      status: text("status").notNull().default("open"),
      // Lower sorts first. Plain integer rather than an enum so reordering
      // doesn't need a migration.
      priority: integer("priority").notNull().default(100),
      createdBy: text("created_by"),
      completedBy: text("completed_by"),
      completedAt: timestamp("completed_at"),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
