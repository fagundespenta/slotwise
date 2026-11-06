import { describe, expect, it } from "vitest";
import { getAvailableSlots, isSlotAvailable, mergeWindows, type SlotQuery, type WeeklyRule } from "@/lib/slots";

const SP = "America/Sao_Paulo"; // UTC-3, no DST since 2019
const NY = "America/New_York"; // DST: 2026-03-08 (spring) and 2026-11-01 (fall)

// 2026-03-16 is a Monday.
const MONDAY = "2026-03-16";
const nineToFive: WeeklyRule[] = [{ weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 }];
const longAgo = new Date("2000-01-01T00:00:00Z");

function base(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: MONDAY,
    timeZone: SP,
    rules: nineToFive,
    durationMin: 60,
    stepMin: 60,
    now: longAgo,
    ...overrides,
  };
}

const iso = (d: { start: Date }) => d.start.toISOString();

describe("getAvailableSlots", () => {
  it("generates slots inside the working window, converted to UTC", () => {
    const slots = getAvailableSlots(base());
    expect(slots).toHaveLength(8);
    // 09:00 in São Paulo (UTC-3) is 12:00 UTC.
    expect(iso(slots[0])).toBe("2026-03-16T12:00:00.000Z");
    expect(slots[7].end.toISOString()).toBe("2026-03-16T20:00:00.000Z");
  });

  it("the same wall-clock rule maps to different UTC instants per timezone", () => {
    const sp = getAvailableSlots(base({ timeZone: SP }))[0];
    const tokyo = getAvailableSlots(base({ timeZone: "Asia/Tokyo" }))[0];
    expect(iso(sp)).toBe("2026-03-16T12:00:00.000Z");
    expect(iso(tokyo)).toBe("2026-03-16T00:00:00.000Z");
  });

  it("returns nothing on a weekday without rules", () => {
    expect(getAvailableSlots(base({ date: "2026-03-15" }))).toEqual([]); // Sunday
  });

  it("returns nothing on a blocked date", () => {
    expect(getAvailableSlots(base({ blockedDates: [MONDAY] }))).toEqual([]);
    expect(getAvailableSlots(base({ blockedDates: new Set(["2026-03-17"]) }))).toHaveLength(8);
  });

  it("does not offer a slot that would run past the end of the window", () => {
    const slots = getAvailableSlots(base({ durationMin: 45, stepMin: 30 }));
    const last = slots[slots.length - 1];
    // 16:00 + 45min = 16:45 fits; 16:30 + 45min = 17:15 does not.
    expect(iso(last)).toBe("2026-03-16T19:00:00.000Z");
  });

  it("supports split shifts (lunch break)", () => {
    const rules: WeeklyRule[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 13 * 60, endMinute: 15 * 60 },
    ];
    const slots = getAvailableSlots(base({ rules }));
    expect(slots.map((s) => s.start.getUTCHours())).toEqual([12, 13, 14, 16, 17]);
  });

  it("merges overlapping rules instead of duplicating slots", () => {
    const rules: WeeklyRule[] = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 1, startMinute: 11 * 60, endMinute: 13 * 60 },
    ];
    expect(mergeWindows(rules)).toEqual([[540, 780]]);
    expect(getAvailableSlots(base({ rules }))).toHaveLength(4);
  });

  it("excludes slots that overlap an existing booking (no double booking)", () => {
    const busy = [
      // 10:30-11:30 local
      { start: new Date("2026-03-16T13:30:00Z"), end: new Date("2026-03-16T14:30:00Z") },
    ];
    const slots = getAvailableSlots(base({ busy, stepMin: 30 }));
    const starts = slots.map(iso);
    // 10:00 (overlaps), 10:30, 11:00 (overlap) are gone; 09:30 ends exactly at 10:30 → allowed.
    expect(starts).not.toContain("2026-03-16T13:00:00.000Z");
    expect(starts).not.toContain("2026-03-16T13:30:00.000Z");
    expect(starts).not.toContain("2026-03-16T14:00:00.000Z");
    expect(starts).toContain("2026-03-16T12:30:00.000Z");
    expect(starts).toContain("2026-03-16T14:30:00.000Z");
  });

  it("treats back-to-back bookings as non-overlapping", () => {
    const busy = [{ start: new Date("2026-03-16T12:00:00Z"), end: new Date("2026-03-16T13:00:00Z") }];
    const starts = getAvailableSlots(base({ busy })).map(iso);
    expect(starts[0]).toBe("2026-03-16T13:00:00.000Z");
  });

  it("hides past slots and respects the minimum notice", () => {
    const now = new Date("2026-03-16T13:10:00Z"); // 10:10 local
    const slots = getAvailableSlots(base({ now, minNoticeMin: 60 }));
    // Earliest bookable instant is 11:10 local → first full-hour slot is 12:00.
    expect(iso(slots[0])).toBe("2026-03-16T15:00:00.000Z");
  });

  it("uses the step to space slot starts", () => {
    const slots = getAvailableSlots(base({ durationMin: 30, stepMin: 15 }));
    // 09:00 .. 16:30 every 15 minutes = 31 slots
    expect(slots).toHaveLength(31);
  });

  it("supports a window that ends at midnight", () => {
    const rules: WeeklyRule[] = [{ weekday: 1, startMinute: 22 * 60, endMinute: 1440 }];
    const slots = getAvailableSlots(base({ rules }));
    expect(slots).toHaveLength(2);
    expect(slots[1].end.toISOString()).toBe("2026-03-17T03:00:00.000Z");
  });

  it("skips wall-clock times that do not exist on the DST spring-forward day", () => {
    // Sunday 2026-03-08: 02:00-02:59 does not exist in New York.
    const rules: WeeklyRule[] = [{ weekday: 0, startMinute: 0, endMinute: 5 * 60 }];
    const slots = getAvailableSlots(base({ date: "2026-03-08", timeZone: NY, rules }));
    expect(slots.map(iso)).toEqual([
      "2026-03-08T05:00:00.000Z", // 00:00 EST
      "2026-03-08T06:00:00.000Z", // 01:00 EST
      // 01:00 + 60min crosses into EDT and ends at 03:00 EDT, still inside the window
      "2026-03-08T07:00:00.000Z", // 03:00 EDT
      "2026-03-08T08:00:00.000Z", // 04:00 EDT
    ]);
  });

  it("produces correct instants on the DST fall-back day", () => {
    // Sunday 2026-11-01: clocks go from 02:00 EDT back to 01:00 EST.
    const rules: WeeklyRule[] = [{ weekday: 0, startMinute: 9 * 60, endMinute: 11 * 60 }];
    const slots = getAvailableSlots(base({ date: "2026-11-01", timeZone: NY, rules }));
    expect(slots.map(iso)).toEqual(["2026-11-01T14:00:00.000Z", "2026-11-01T15:00:00.000Z"]);
  });

  it("rejects invalid input", () => {
    expect(() => getAvailableSlots(base({ durationMin: 0 }))).toThrow();
    expect(() => getAvailableSlots(base({ date: "2026-02-30" }))).toThrow();
  });
});

describe("isSlotAvailable", () => {
  it("accepts only exact offered slot starts", () => {
    expect(isSlotAvailable(base(), new Date("2026-03-16T12:00:00Z"))).toBe(true);
    expect(isSlotAvailable(base(), new Date("2026-03-16T12:05:00Z"))).toBe(false);
    const busy = [{ start: new Date("2026-03-16T12:00:00Z"), end: new Date("2026-03-16T13:00:00Z") }];
    expect(isSlotAvailable(base({ busy }), new Date("2026-03-16T12:00:00Z"))).toBe(false);
  });
});
