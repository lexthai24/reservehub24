import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gt, gte, ilike, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { auditLogs, bookings, notifications, resources, users, waitingList } from "./db/schema.js";
import { hashPassword, setSession, verifyPassword } from "./auth.js";
import { BookingStatus, ResourceStatus, UserRole, adminPasswordSchema, bookingSchema, changePasswordSchema, loginSchema, registerSchema, resourceSchema, updateRoleSchema, waitingListSchema } from "@reservehub/shared";

function badRequest(message: string): never { throw Object.assign(new Error(message), { statusCode: 400 }); }
function notFound(message: string): never { throw Object.assign(new Error(message), { statusCode: 404 }); }
function conflict(message: string): never { throw Object.assign(new Error(message), { statusCode: 409 }); }

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) conflict("An account with this email already exists");
    const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(input.password), fullName: input.fullName, role: UserRole.MEMBER }).returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });
    if (!user) throw new Error("Unable to create user");
    const authUser = { ...user, role: user.role as "MEMBER" | "ADMIN", sessionVersion: 0 };
    await setSession(reply, authUser);
    return reply.code(201).send({ data: { id: authUser.id, email: authUser.email, fullName: authUser.fullName, role: authUser.role } });
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect" });
    const authUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role as "MEMBER" | "ADMIN", sessionVersion: user.sessionVersion };
    await setSession(reply, authUser, input.rememberMe);
    return { data: { id: authUser.id, email: authUser.email, fullName: authUser.fullName, role: authUser.role } };
  });

  app.post("/api/auth/logout", async (_request, reply) => { reply.clearCookie("reservehub_session", { path: "/" }); return { data: { success: true } }; });
  app.get("/api/auth/me", { preHandler: app.authenticate }, async (request) => ({ data: { id: request.authUser!.id, email: request.authUser!.email, fullName: request.authUser!.fullName, role: request.authUser!.role } }));
  app.patch("/api/auth/me", { preHandler: app.authenticate }, async (request) => {
    const input = registerSchema.pick({ fullName: true }).parse(request.body);
    const [user] = await db.update(users).set({ fullName: input.fullName, updatedAt: new Date() }).where(eq(users.id, request.authUser!.id)).returning({ id: users.id, email: users.email, fullName: users.fullName, role: users.role });
    if (!user) notFound("User not found");
    return { data: { ...user, role: user.role as "MEMBER" | "ADMIN" } };
  });
  app.post("/api/auth/change-password", { preHandler: app.authenticate }, async (request, reply) => {
    const input = changePasswordSchema.parse(request.body);
    if (input.currentPassword === input.newPassword) badRequest("New password must be different from the current password");
    const [user] = await db.select({ passwordHash: users.passwordHash, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, request.authUser!.id)).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) return reply.code(400).send({ error: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect" });
    const nextSessionVersion = user.sessionVersion + 1;
    await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), sessionVersion: nextSessionVersion, updatedAt: new Date() }).where(eq(users.id, request.authUser!.id));
    await db.insert(auditLogs).values({ actorUserId: request.authUser!.id, action: "PASSWORD_CHANGED", entityType: "user", entityId: request.authUser!.id });
    await setSession(reply, { ...request.authUser!, sessionVersion: nextSessionVersion });
    return { data: { success: true } };
  });

  app.get("/api/resources", async (request) => {
    const query = request.query as { q?: string; type?: string; status?: string; location?: string; minCapacity?: string; page?: string; pageSize?: string };
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const conditions = [eq(resources.status, query.status ?? ResourceStatus.ACTIVE)];
    if (query.q) conditions.push(or(ilike(resources.name, `%${query.q}%`), ilike(resources.description, `%${query.q}%`))!);
    if (query.type) conditions.push(eq(resources.resourceType, query.type));
    if (query.location) conditions.push(ilike(resources.location, `%${query.location}%`));
    if (query.minCapacity) conditions.push(gte(resources.capacity, Number(query.minCapacity)));
    const [items, count] = await Promise.all([
      db.select().from(resources).where(and(...conditions)).orderBy(asc(resources.name)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(resources).where(and(...conditions)),
    ]);
    return { data: items, meta: { page, pageSize, total: Number(count[0]?.count ?? 0) } };
  });

  app.post("/api/resources", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const input = resourceSchema.parse(request.body);
    const [resource] = await db.insert(resources).values({ ...input, createdBy: request.authUser?.id ?? null, status: ResourceStatus.ACTIVE }).returning();
    if (!resource) throw new Error("Unable to create resource");
    await db.insert(auditLogs).values({ actorUserId: request.authUser?.id, action: "RESOURCE_CREATED", entityType: "resource", entityId: resource.id, metadata: { name: resource.name } });
    return reply.code(201).send({ data: resource });
  });

  app.get("/api/resources/:resourceId", async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1);
    if (!resource) notFound("Resource not found");
    return { data: resource };
  });

  app.patch("/api/resources/:resourceId", { preHandler: [app.authenticate, app.requireAdmin] }, async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const input = resourceSchema.partial().parse(request.body);
    const [resource] = await db.update(resources).set({ ...input, updatedAt: new Date() }).where(eq(resources.id, resourceId)).returning();
    if (!resource) notFound("Resource not found");
    await db.insert(auditLogs).values({ actorUserId: request.authUser?.id, action: "RESOURCE_UPDATED", entityType: "resource", entityId: resourceId, metadata: input });
    return { data: resource };
  });

  app.delete("/api/resources/:resourceId", { preHandler: [app.authenticate, app.requireAdmin] }, async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const [resource] = await db.update(resources).set({ status: ResourceStatus.ARCHIVED, updatedAt: new Date() }).where(eq(resources.id, resourceId)).returning({ id: resources.id });
    if (!resource) notFound("Resource not found");
    await db.insert(auditLogs).values({ actorUserId: request.authUser?.id, action: "RESOURCE_ARCHIVED", entityType: "resource", entityId: resourceId });
    return { data: { success: true } };
  });

  app.get("/api/resources/:resourceId/availability", async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const query = request.query as { from?: string; to?: string };
    const from = new Date(query.from ?? new Date().toISOString());
    const to = new Date(query.to ?? new Date(Date.now() + 7 * 86_400_000).toISOString());
    const items = await db.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt }).from(bookings).where(and(eq(bookings.resourceId, resourceId), eq(bookings.status, BookingStatus.CONFIRMED), lt(bookings.startsAt, to), gt(bookings.endsAt, from))).orderBy(asc(bookings.startsAt));
    return { data: items };
  });

  app.get("/api/resources/:resourceId/suggestions", { preHandler: app.authenticate }, async (request) => {
    const { resourceId } = request.params as { resourceId: string };
    const [current] = await db.select({ capacity: resources.capacity, resourceType: resources.resourceType, location: resources.location }).from(resources).where(eq(resources.id, resourceId)).limit(1);
    if (!current) notFound("Resource not found");
    const locationMatch = current.location ? eq(resources.location, current.location) : isNull(resources.location);
    const suggestions = await db.select().from(resources).where(and(eq(resources.status, ResourceStatus.ACTIVE), or(eq(resources.resourceType, current.resourceType), locationMatch), sql`${resources.id} <> ${resourceId}`)).orderBy(asc(resources.name)).limit(5);
    return { data: suggestions };
  });

  app.post("/api/bookings", { preHandler: app.authenticate }, async (request, reply) => {
    const input = bookingSchema.parse(request.body);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (duration <= 0 || duration > 8 * 60 * 60 * 1000) badRequest("Bookings must be between 1 minute and 8 hours");
    if (startsAt.getTime() < Date.now() - 60_000) badRequest("Bookings cannot start in the past");
    try {
      const booking = await db.transaction(async (trx) => {
        const [resource] = await trx.select({ id: resources.id }).from(resources).where(and(eq(resources.id, input.resourceId), eq(resources.status, ResourceStatus.ACTIVE))).limit(1);
        if (!resource) notFound("Active resource not found");
        if (input.idempotencyKey) {
          const [existing] = await trx.select().from(bookings).where(and(eq(bookings.userId, request.authUser!.id), eq(bookings.idempotencyKey, input.idempotencyKey))).limit(1);
          if (existing) return existing;
        }
        const [existingConflict] = await trx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.resourceId, input.resourceId), eq(bookings.status, BookingStatus.CONFIRMED), lt(bookings.startsAt, endsAt), gt(bookings.endsAt, startsAt))).limit(1);
        if (existingConflict) conflict("That time slot is already reserved");
        const [created] = await trx.insert(bookings).values({ resourceId: input.resourceId, userId: request.authUser!.id, startsAt, endsAt, notes: input.notes, idempotencyKey: input.idempotencyKey, status: BookingStatus.CONFIRMED }).returning();
        if (!created) throw new Error("Unable to create booking");
        return created;
      });
      return reply.code(201).send({ data: booking });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23P01") return reply.code(409).send({ error: "BOOKING_CONFLICT", message: "That time slot is already reserved" });
      throw error;
    }
  });

  app.get("/api/bookings/me", { preHandler: app.authenticate }, async (request) => {
    const items = await db.select({ booking: bookings, resource: resources }).from(bookings).innerJoin(resources, eq(resources.id, bookings.resourceId)).where(eq(bookings.userId, request.authUser!.id)).orderBy(desc(bookings.startsAt));
    return { data: items.map(({ booking, resource }) => ({ ...booking, resource })) };
  });

  app.get("/api/bookings/:bookingId", { preHandler: app.authenticate }, async (request) => {
    const { bookingId } = request.params as { bookingId: string };
    const [item] = await db.select({ booking: bookings, resource: resources }).from(bookings).innerJoin(resources, eq(resources.id, bookings.resourceId)).where(and(eq(bookings.id, bookingId), or(eq(bookings.userId, request.authUser!.id), eq(sql`${request.authUser!.role}`, UserRole.ADMIN)))).limit(1);
    if (!item) notFound("Booking not found");
    return { data: { ...item.booking, resource: item.resource } };
  });

  app.patch("/api/bookings/:bookingId", { preHandler: app.authenticate }, async (request) => {
    const { bookingId } = request.params as { bookingId: string };
    const input = bookingSchema.pick({ startsAt: true, endsAt: true, notes: true }).partial().parse(request.body);
    const [existing] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.userId, request.authUser!.id), eq(bookings.status, BookingStatus.CONFIRMED))).limit(1);
    if (!existing) notFound("Active booking not found");
    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    const duration = endsAt.getTime() - startsAt.getTime();
    if (startsAt.getTime() < Date.now() - 60_000 || duration <= 0 || duration > 8 * 60 * 60 * 1000) badRequest("Booking time must be valid and no longer than 8 hours");
    const [overlap] = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.resourceId, existing.resourceId), eq(bookings.status, BookingStatus.CONFIRMED), sql`${bookings.id} <> ${bookingId}`, lt(bookings.startsAt, endsAt), gt(bookings.endsAt, startsAt))).limit(1);
    if (overlap) conflict("That time slot is already reserved");
    const [updated] = await db.update(bookings).set({ startsAt, endsAt, notes: input.notes ?? existing.notes, updatedAt: new Date() }).where(eq(bookings.id, bookingId)).returning();
    return { data: updated };
  });

  app.post("/api/bookings/:bookingId/cancel", { preHandler: app.authenticate }, async (request) => {
    const { bookingId } = request.params as { bookingId: string };
    const [booking] = await db.update(bookings).set({ status: BookingStatus.CANCELLED, updatedAt: new Date() }).where(and(eq(bookings.id, bookingId), or(eq(bookings.userId, request.authUser!.id), eq(sql`${request.authUser!.role}`, UserRole.ADMIN)), eq(bookings.status, BookingStatus.CONFIRMED))).returning();
    if (!booking) notFound("Active booking not found");
    return { data: booking };
  });

  app.post("/api/waiting-list", { preHandler: app.authenticate }, async (request, reply) => {
    const input = waitingListSchema.parse(request.body);
    if (new Date(input.requestedEnd) <= new Date(input.requestedStart)) badRequest("Requested end must be after requested start");
    const [entry] = await db.insert(waitingList).values({ resourceId: input.resourceId, userId: request.authUser!.id, requestedStart: new Date(input.requestedStart), requestedEnd: new Date(input.requestedEnd), priority: input.priority }).returning();
    return reply.code(201).send({ data: entry });
  });
  app.get("/api/waiting-list/me", { preHandler: app.authenticate }, async (request) => ({ data: await db.select().from(waitingList).where(eq(waitingList.userId, request.authUser!.id)).orderBy(desc(waitingList.createdAt)) }));
  app.delete("/api/waiting-list/:waitingListId", { preHandler: app.authenticate }, async (request) => { const { waitingListId } = request.params as { waitingListId: string }; const [entry] = await db.update(waitingList).set({ status: "CANCELLED" }).where(and(eq(waitingList.id, waitingListId), eq(waitingList.userId, request.authUser!.id))).returning(); if (!entry) notFound("Waiting list entry not found"); return { data: entry }; });

  app.get("/api/analytics/overview", { preHandler: app.authenticate }, async () => {
    const [total, confirmed, resourcesCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(bookings),
      db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.status, BookingStatus.CONFIRMED)),
      db.select({ count: sql<number>`count(*)` }).from(resources).where(eq(resources.status, ResourceStatus.ACTIVE)),
    ]);
    return { data: { totalBookings: Number(total[0]?.count ?? 0), confirmedBookings: Number(confirmed[0]?.count ?? 0), activeResources: Number(resourcesCount[0]?.count ?? 0) } };
  });
  app.get("/api/analytics/resource-usage", { preHandler: [app.authenticate, app.requireAdmin] }, async () => ({ data: await db.select({ resourceId: resources.id, resourceName: resources.name, usageCount: sql<number>`count(${bookings.id})` }).from(resources).leftJoin(bookings, and(eq(bookings.resourceId, resources.id), eq(bookings.status, BookingStatus.CONFIRMED))).groupBy(resources.id).orderBy(desc(sql`count(${bookings.id})`)).limit(10) }));
  app.get("/api/analytics/peak-hours", { preHandler: [app.authenticate, app.requireAdmin] }, async () => ({ data: await db.select({ hour: sql<number>`extract(hour from ${bookings.startsAt})`, usageCount: sql<number>`count(*)` }).from(bookings).where(eq(bookings.status, BookingStatus.CONFIRMED)).groupBy(sql`extract(hour from ${bookings.startsAt})`).orderBy(desc(sql`count(*)`)) }));

  app.get("/api/notifications", { preHandler: app.authenticate }, async (request) => ({ data: await db.select().from(notifications).where(eq(notifications.userId, request.authUser!.id)).orderBy(desc(notifications.createdAt)).limit(50) }));
  app.patch("/api/notifications/:notificationId/read", { preHandler: app.authenticate }, async (request) => { const { notificationId } = request.params as { notificationId: string }; const [notification] = await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, request.authUser!.id))).returning(); if (!notification) notFound("Notification not found"); return { data: notification }; });

  app.get("/api/admin/users", { preHandler: [app.authenticate, app.requireAdmin] }, async () => ({ data: await db.select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, createdAt: users.createdAt }).from(users).orderBy(asc(users.fullName)) }));
  app.patch("/api/admin/users/:userId/role", { preHandler: [app.authenticate, app.requireAdmin] }, async (request) => { const { userId } = request.params as { userId: string }; const input = updateRoleSchema.parse(request.body); const [user] = await db.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role }); if (!user) notFound("User not found"); await db.insert(auditLogs).values({ actorUserId: request.authUser!.id, action: "USER_ROLE_UPDATED", entityType: "user", entityId: userId, metadata: { role: input.role } }); return { data: user }; });
  app.patch("/api/admin/users/:userId/password", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const input = adminPasswordSchema.parse(request.body);
    const [user] = await db.select({ id: users.id, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) notFound("User not found");
    const nextSessionVersion = user.sessionVersion + 1;
    await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), sessionVersion: nextSessionVersion, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.insert(auditLogs).values({ actorUserId: request.authUser!.id, action: "USER_PASSWORD_RESET", entityType: "user", entityId: userId });
    if (userId === request.authUser!.id) await setSession(reply, { ...request.authUser!, sessionVersion: nextSessionVersion });
    return { data: { success: true } };
  });
  app.get("/api/admin/audit-logs", { preHandler: [app.authenticate, app.requireAdmin] }, async () => ({ data: await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100) }));
}
