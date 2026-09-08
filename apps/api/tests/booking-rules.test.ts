import { describe, expect, it } from "vitest";

function isValidBooking(startsAt: Date, endsAt: Date, now = new Date("2026-01-01T00:00:00Z")): boolean {
  const duration = endsAt.getTime() - startsAt.getTime();
  return startsAt > now && duration > 0 && duration <= 8 * 60 * 60 * 1000;
}

describe("booking business rules", () => {
  it("rejects past, reversed, and overlong bookings", () => {
    expect(isValidBooking(new Date("2025-12-31T23:00:00Z"), new Date("2026-01-01T01:00:00Z"))).toBe(false);
    expect(isValidBooking(new Date("2026-01-02T10:00:00Z"), new Date("2026-01-02T09:00:00Z"))).toBe(false);
    expect(isValidBooking(new Date("2026-01-02T10:00:00Z"), new Date("2026-01-02T19:00:00Z"))).toBe(false);
  });
});
