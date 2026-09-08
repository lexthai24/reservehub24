import { relations, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar, index } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("MEMBER"),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  resourceType: varchar("resource_type", { length: 30 }).notNull(),
  location: varchar("location", { length: 160 }),
  capacity: integer("capacity"),
  timezone: varchar("timezone", { length: 80 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps,
}, (table) => [index("resources_status_idx").on(table.status), index("resources_type_idx").on(table.resourceType)]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  resourceId: uuid("resource_id").references(() => resources.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("CONFIRMED"),
  notes: text("notes"),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  ...timestamps,
}, (table) => [index("bookings_resource_start_idx").on(table.resourceId, table.startsAt), index("bookings_user_start_idx").on(table.userId, table.startsAt), uniqueIndex("bookings_user_idempotency_idx").on(table.userId, table.idempotencyKey)]);

export const waitingList = pgTable("waiting_list", {
  id: uuid("id").defaultRandom().primaryKey(),
  resourceId: uuid("resource_id").references(() => resources.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  requestedStart: timestamp("requested_start", { withTimezone: true }).notNull(),
  requestedEnd: timestamp("requested_end", { withTimezone: true }).notNull(),
  priority: integer("priority").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("WAITING"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("waiting_list_priority_idx").on(table.resourceId, table.status, table.priority, table.createdAt)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("notifications_user_read_idx").on(table.userId, table.readAt)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_logs_entity_idx").on(table.entityType, table.entityId)]);

export const userRelations = relations(users, ({ many }) => ({ bookings: many(bookings), resources: many(resources) }));
export const resourceRelations = relations(resources, ({ many }) => ({ bookings: many(bookings), waitingList: many(waitingList) }));
export const bookingRelations = relations(bookings, ({ one }) => ({ resource: one(resources, { fields: [bookings.resourceId], references: [resources.id] }), user: one(users, { fields: [bookings.userId], references: [users.id] }) }));

export const exclusionConstraintSql = sql`EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'CONFIRMED')`;
