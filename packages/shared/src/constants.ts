export const UserRole = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ResourceStatus = { ACTIVE: "ACTIVE", ARCHIVED: "ARCHIVED" } as const;
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];

export const BookingStatus = {
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const WaitingListStatus = {
  WAITING: "WAITING",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
} as const;
export type WaitingListStatus = (typeof WaitingListStatus)[keyof typeof WaitingListStatus];

export const ResourceType = {
  MEETING_ROOM: "MEETING_ROOM",
  DESK: "DESK",
  EQUIPMENT: "EQUIPMENT",
  STUDIO: "STUDIO",
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
