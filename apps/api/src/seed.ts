import "./env.js";
import { db, pool } from "./db/client.js";
import { auditLogs, bookings, notifications, resources, users, waitingList } from "./db/schema.js";
import { hashPassword } from "./auth.js";

async function seed(): Promise<void> {
  const [admin, memberOne, memberTwo] = await db.insert(users).values([
    { email: "admin@reservehub.local", passwordHash: await hashPassword("Admin123!"), fullName: "Ari Somchai", role: "ADMIN" },
    { email: "narin@reservehub.local", passwordHash: await hashPassword("Member123!"), fullName: "Narin Lim", role: "MEMBER" },
    { email: "mali@reservehub.local", passwordHash: await hashPassword("Member123!"), fullName: "Mali Chen", role: "MEMBER" },
  ]).onConflictDoNothing().returning();
  const ownerId = admin?.id;
  const [atlas, lotus, northStar, , makerLab, bloom, quietPod] = await db.insert(resources).values([
    { name: "Atlas Boardroom", description: "Bright boardroom with hybrid meeting setup.", imageUrl: "/resources/atlas-boardroom.png", resourceType: "MEETING_ROOM", location: "Bangkok HQ", capacity: 12, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "Lotus Focus Room", description: "Quiet room for focused team conversations.", imageUrl: "/resources/lotus-focus-room.png", resourceType: "MEETING_ROOM", location: "Bangkok HQ", capacity: 6, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "North Star Desk 24", description: "Ergonomic hot desk with a 4K monitor.", imageUrl: "/resources/north-star-desk.png", resourceType: "DESK", location: "Chiang Mai Hub", capacity: 1, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "Presentation Projector", description: "Portable 4K projector for workshops and presentations.", imageUrl: "/resources/presentation-projector.png", resourceType: "EQUIPMENT", location: "Bangkok HQ", capacity: 1, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "Maker Lab", description: "Creative studio with prototyping equipment.", imageUrl: "/resources/atlas-boardroom.png", resourceType: "STUDIO", location: "Bangkok HQ", capacity: 18, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "Bloom Huddle", description: "Small room for quick team syncs.", imageUrl: "/resources/lotus-focus-room.png", resourceType: "MEETING_ROOM", location: "Phuket Office", capacity: 4, timezone: "Asia/Bangkok", createdBy: ownerId },
    { name: "Quiet Pod 07", description: "Acoustically isolated focus pod.", imageUrl: "/resources/lotus-focus-room.png", resourceType: "DESK", location: "Bangkok HQ", capacity: 1, timezone: "Asia/Bangkok", createdBy: ownerId },
  ]).onConflictDoNothing().returning();
  const userId = memberOne?.id;
  const secondUserId = memberTwo?.id;
  if (userId && atlas?.id && northStar?.id && makerLab?.id) {
    const now = new Date();
    const plusHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
    await db.insert(bookings).values([
      { resourceId: atlas.id, userId, startsAt: plusHours(3), endsAt: plusHours(4.5), notes: "Quarterly planning", status: "CONFIRMED" },
      { resourceId: northStar.id, userId, startsAt: plusHours(28), endsAt: plusHours(32), notes: "Deep work", status: "CONFIRMED" },
      { resourceId: makerLab.id, userId: secondUserId ?? userId, startsAt: plusHours(50), endsAt: plusHours(52), notes: "Prototype session", status: "CONFIRMED" },
    ]).onConflictDoNothing();
  }
  if (userId && lotus?.id) await db.insert(waitingList).values({ resourceId: lotus.id, userId, requestedStart: new Date(Date.now() + 86_400_000), requestedEnd: new Date(Date.now() + 90_000_000), priority: 5 }).onConflictDoNothing();
  if (userId) await db.insert(notifications).values([{ userId, type: "BOOKING_CONFIRMED", title: "Booking confirmed", message: "Your Atlas Boardroom booking is confirmed." }, { userId, type: "SUGGESTION", title: "A room picked for you", message: "Lotus Focus Room is available for your next small team sync." }]).onConflictDoNothing();
  if (admin?.id && atlas?.id) await db.insert(auditLogs).values({ actorUserId: admin.id, action: "RESOURCE_CREATED", entityType: "resource", entityId: atlas.id, metadata: { seeded: true } });
  console.log("ReserveHub seed complete");
}

seed().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
