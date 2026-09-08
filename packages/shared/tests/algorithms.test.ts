import { describe, expect, it } from "vitest";
import { calculateAvailableSlots, topKResources, WaitingListPriorityQueue } from "../src/algorithms.js";

describe("availability calculation", () => {
  it("sorts and scans overlapping bookings", () => {
    const date = (hour: number) => new Date(`2026-01-01T${String(hour).padStart(2, "0")}:00:00Z`);
    const slots = calculateAvailableSlots(
      { startsAt: date(9), endsAt: date(18) },
      [{ startsAt: date(13), endsAt: date(14) }, { startsAt: date(10), endsAt: date(12) }],
    );
    expect(slots.map((slot) => [slot.startsAt.getUTCHours(), slot.endsAt.getUTCHours()])).toEqual([[9, 10], [12, 13], [14, 18]]);
  });
});

describe("waiting list priority queue", () => {
  it("prefers priority, then the earliest request", () => {
    const queue = new WaitingListPriorityQueue();
    queue.push({ id: "late", priority: 2, createdAt: new Date("2026-01-01T10:00:00Z"), startsAt: new Date(), endsAt: new Date() });
    queue.push({ id: "early", priority: 2, createdAt: new Date("2026-01-01T09:00:00Z"), startsAt: new Date(), endsAt: new Date() });
    queue.push({ id: "highest", priority: 3, createdAt: new Date("2026-01-01T12:00:00Z"), startsAt: new Date(), endsAt: new Date() });
    expect(queue.pop()?.id).toBe("highest");
    expect(queue.pop()?.id).toBe("early");
  });
});

describe("top-k resources", () => {
  it("returns the most used resources", () => {
    expect(topKResources([
      { resourceId: "a", resourceName: "A", usageCount: 4 },
      { resourceId: "b", resourceName: "B", usageCount: 9 },
      { resourceId: "a", resourceName: "A", usageCount: 3 },
    ], 1)[0]?.resourceId).toBe("b");
  });
});
