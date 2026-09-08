import { z } from "zod";
import { ResourceType, UserRole } from "./constants.js";

const isoDateTime = z.string().datetime({ offset: true });

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  resourceType: z.enum([ResourceType.MEETING_ROOM, ResourceType.DESK, ResourceType.EQUIPMENT, ResourceType.STUDIO]),
  location: z.string().max(160).nullable().optional(),
  capacity: z.number().int().positive().max(500).nullable().optional(),
  timezone: z.string().min(1).max(80),
});

export const bookingSchema = z.object({
  resourceId: z.string().uuid(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export const waitingListSchema = z.object({
  resourceId: z.string().uuid(),
  requestedStart: isoDateTime,
  requestedEnd: isoDateTime,
  priority: z.number().int().min(0).max(100).default(0),
});

export const updateRoleSchema = z.object({ role: z.enum([UserRole.MEMBER, UserRole.ADMIN]) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResourceInput = z.infer<typeof resourceSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type WaitingListInput = z.infer<typeof waitingListSchema>;
