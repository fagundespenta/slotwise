import { TZDate } from "@date-fns/tz";

/** A calendar date with no time or zone attached, e.g. "2026-03-14". */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // Round-trip through UTC to reject things like 2026-02-30.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`Invalid date "${date}"`);
  }
  return { year, month, day };
}

export function isValidIsoDate(date: string): boolean {
  try {
    parseIsoDate(date);
    return true;
  } catch {
    return false;
  }
}

/** Day of week (0 = Sunday) of a calendar date. Independent of any timezone. */
export function weekdayOf(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Adds whole calendar days to an ISO date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock date and minute-of-day of an instant, as seen in `timeZone`. */
export function wallClock(instant: Date, timeZone: string): { date: IsoDate; minute: number } {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Today's calendar date in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  return wallClock(now, timeZone).date;
}

/**
 * Converts a wall-clock time in `timeZone` to a UTC instant.
 * Returns `null` when that wall time does not exist (DST spring-forward gap).
 * For ambiguous times (DST fall-back) the earlier instant is returned.
 */
export function zonedToUtc(date: IsoDate, minuteOfDay: number, timeZone: string): Date | null {
  const { year, month, day } = parseIsoDate(date);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const instant = new Date(+new TZDate(year, month - 1, day, hour, minute, timeZone));
  const check = wallClock(instant, timeZone);
  if (check.date !== date || check.minute !== minuteOfDay) return null;
  return instant;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) throw new Error(`Invalid time "${value}"`);
  return h * 60 + min;
}
