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
