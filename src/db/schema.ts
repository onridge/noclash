import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// owner_id is a plain uuid for now, no FK — Auth isn't wired up until
// Phase 3, and only then does auth.users exist to reference. See
// DEVELOPMENT_PLAN.md Phase 3.
export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    timezone: text("timezone").notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(60),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    maxAdvanceDays: integer("max_advance_days").notNull().default(60),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "resources_slot_minutes_range",
      sql`${table.slotMinutes} between 5 and 480`,
    ),
    check("resources_buffer_minutes_nonneg", sql`${table.bufferMinutes} >= 0`),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }),
    effectiveTo: date("effective_to", { mode: "string" }),
  },
  (table) => [
    check(
      "availability_rules_weekday_range",
      sql`${table.weekday} between 0 and 6`,
    ),
    check(
      "availability_rules_ends_after_starts",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);
