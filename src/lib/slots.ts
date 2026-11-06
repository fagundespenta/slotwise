import { type IsoDate, weekdayOf, zonedToUtc } from "./time";

/**
 * Slot calculation for Slotwise.
 *
 * This module is pure (no I/O, no clock access) so it can be unit tested
 * exhaustively. The caller loads rules, blocked dates and existing bookings
 * from the database and passes `now` explicitly.
 */

export interface WeeklyRule {
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  /** Minutes from local midnight, inclusive. */
  startMinute: number;
  /** Minutes from local midnight, exclusive. Max 1440. */
  endMinute: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotQuery {
  /** Calendar date in the business timezone. */
  date: IsoDate;
  /** IANA timezone of the business, e.g. "America/Sao_Paulo". */
  timeZone: string;
  rules: WeeklyRule[];
  /** Dates ("YYYY-MM-DD") the business is closed. */
  blockedDates?: Iterable<IsoDate>;
  /** Already-taken intervals (confirmed bookings and live payment holds). */
  busy?: Interval[];
  /** Length of the service being booked. */
  durationMin: number;
  /** Distance between consecutive slot starts. Defaults to 15 minutes. */
  stepMin?: number;
  /** Earliest bookable instant is `now + minNoticeMin`. */
  now: Date;
  minNoticeMin?: number;
}

export interface Slot {
  start: Date;
  end: Date;
}

const MINUTE = 60_000;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Merges overlapping/adjacent windows of the same weekday so slots are never duplicated. */
export function mergeWindows(rules: WeeklyRule[]): Array<[number, number]> {
  const sorted = rules
    .map((r) => [Math.max(0, r.startMinute), Math.min(1440, r.endMinute)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else merged.push([...w]);
  }
  return merged;
}

export function getAvailableSlots(q: SlotQuery): Slot[] {
  const step = q.stepMin ?? 15;
  if (q.durationMin <= 0) throw new Error("durationMin must be positive");
  if (step <= 0) throw new Error("stepMin must be positive");

  for (const d of q.blockedDates ?? []) {
    if (d === q.date) return [];
  }

  const weekday = weekdayOf(q.date);
  const windows = mergeWindows(q.rules.filter((r) => r.weekday === weekday));
  if (windows.length === 0) return [];

  const earliest = new Date(q.now.getTime() + (q.minNoticeMin ?? 0) * MINUTE);
  const busy = [...(q.busy ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime());
  const slots: Slot[] = [];

  for (const [winStart, winEnd] of windows) {
    // The window's end is also a wall-clock time; resolve it to an instant so
    // a service that crosses a DST change still ends inside the window.
    const windowEnd = zonedToUtc(q.date, winEnd === 1440 ? 1439 : winEnd, q.timeZone);
    const windowEndInstant = windowEnd
      ? new Date(windowEnd.getTime() + (winEnd === 1440 ? MINUTE : 0))
      : null;

    for (let minute = winStart; minute + q.durationMin <= winEnd; minute += step) {
      const start = zonedToUtc(q.date, minute, q.timeZone);
      if (!start) continue; // wall time skipped by DST
      const end = new Date(start.getTime() + q.durationMin * MINUTE);
      if (windowEndInstant && end > windowEndInstant) continue;
      if (start < earliest) continue;
      const candidate = { start, end };
      if (busy.some((b) => overlaps(candidate, b))) continue;
      slots.push(candidate);
    }
  }

  return slots;
}

/** True when `start` is exactly one of the slots offered for that query. */
export function isSlotAvailable(q: SlotQuery, start: Date): boolean {
  return getAvailableSlots(q).some((s) => s.start.getTime() === start.getTime());
}
