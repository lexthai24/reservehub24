export interface TimeInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface AvailableSlot extends TimeInterval {}

/** Sorts once, then scans intervals. Complexity: O(n log n) time and O(n) space. */
export function calculateAvailableSlots(
  window: TimeInterval,
  confirmedBookings: readonly TimeInterval[],
  minimumDurationMinutes = 30,
): AvailableSlot[] {
  const relevant = confirmedBookings
    .filter((booking) => booking.endsAt > window.startsAt && booking.startsAt < window.endsAt)
    .map((booking) => ({
      startsAt: new Date(Math.max(booking.startsAt.getTime(), window.startsAt.getTime())),
      endsAt: new Date(Math.min(booking.endsAt.getTime(), window.endsAt.getTime())),
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const slots: AvailableSlot[] = [];
  let cursor = window.startsAt;
  for (const booking of relevant) {
    if (booking.startsAt.getTime() - cursor.getTime() >= minimumDurationMinutes * 60_000) {
      slots.push({ startsAt: cursor, endsAt: booking.startsAt });
    }
    if (booking.endsAt > cursor) cursor = booking.endsAt;
  }
  if (window.endsAt.getTime() - cursor.getTime() >= minimumDurationMinutes * 60_000) {
    slots.push({ startsAt: cursor, endsAt: window.endsAt });
  }
  return slots;
}

export interface WaitingListEntry extends TimeInterval {
  id: string;
  priority: number;
  createdAt: Date;
}

/** A binary max-heap. Insert and remove are O(log n), peek is O(1). */
export class WaitingListPriorityQueue {
  private readonly entries: WaitingListEntry[] = [];

  get size(): number { return this.entries.length; }

  push(entry: WaitingListEntry): void {
    this.entries.push(entry);
    this.bubbleUp(this.entries.length - 1);
  }

  peek(): WaitingListEntry | undefined { return this.entries[0]; }

  pop(): WaitingListEntry | undefined {
    if (this.entries.length === 0) return undefined;
    const first = this.entries[0];
    const last = this.entries.pop();
    if (last && this.entries.length > 0) {
      this.entries[0] = last;
      this.bubbleDown(0);
    }
    return first;
  }

  private outranks(left: WaitingListEntry, right: WaitingListEntry): boolean {
    return left.priority > right.priority || (left.priority === right.priority && left.createdAt < right.createdAt);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.entries[index];
      const parent = this.entries[parentIndex];
      if (!current || !parent || !this.outranks(current, parent)) break;
      this.entries[index] = parent;
      this.entries[parentIndex] = current;
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let bestIndex = index;
      const current = this.entries[index];
      const left = this.entries[leftIndex];
      const right = this.entries[rightIndex];
      if (left && current && this.outranks(left, current)) bestIndex = leftIndex;
      const best = this.entries[bestIndex];
      if (right && best && this.outranks(right, best)) bestIndex = rightIndex;
      if (bestIndex === index) break;
      const next = this.entries[bestIndex];
      if (!current || !next) break;
      this.entries[index] = next;
      this.entries[bestIndex] = current;
      index = bestIndex;
    }
  }
}

export interface UsageRecord { resourceId: string; resourceName: string; usageCount: number; }

/** Counts in O(n), then keeps only k records in a min-heap: O(n log k). */
export function topKResources(records: readonly UsageRecord[], k: number): UsageRecord[] {
  if (k <= 0) return [];
  const counts = new Map<string, UsageRecord>();
  for (const record of records) {
    const existing = counts.get(record.resourceId);
    counts.set(record.resourceId, {
      ...record,
      usageCount: (existing?.usageCount ?? 0) + record.usageCount,
    });
  }
  return [...counts.values()].sort((left, right) => right.usageCount - left.usageCount).slice(0, k);
}
