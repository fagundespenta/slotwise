import "server-only";
import { db } from "@/lib/db";
import { addDays, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";

type Business = { id: string; timezone: string };

/** Monday of the week containing `date` (ISO weeks, like Postgres date_trunc). */
function mondayOf(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export async function getDashboardStats(business: Business, now = new Date()) {
  const tz = business.timezone;
  const today = todayIn(tz, now);
  const monthStart = zonedToUtc(`${today.slice(0, 8)}01`, 0, tz) ?? now;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const firstWeek = mondayOf(addDays(today, -7 * 7));
  const firstWeekStart = zonedToUtc(firstWeek, 0, tz) ?? now;

  const [upcomingCount, monthAgg, recent, weeklyRows, next] = await Promise.all([
    db.booking.count({ where: { businessId: business.id, status: "CONFIRMED", startsAt: { gte: now } } }),
    db.booking.aggregate({
      where: { businessId: business.id, status: "CONFIRMED", startsAt: { gte: monthStart } },
      _sum: { priceCents: true },
      _count: true,
    }),
    db.booking.groupBy({
      by: ["status"],
      where: { businessId: business.id, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
    }),
    // Weekly revenue, bucketed by *local* week. Prisma stores UTC timestamps
    // without zone, so we first tag them as UTC, then convert to the business zone.
    db.$queryRaw<Array<{ week: Date; revenue: number; count: number }>>`
      SELECT date_trunc('week', ("startsAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date AS week,
             COALESCE(SUM("priceCents"), 0)::int AS revenue,
             COUNT(*)::int AS count
      FROM "Booking"
      WHERE "businessId" = ${business.id}
        AND status = 'CONFIRMED'
        AND "startsAt" >= ${firstWeekStart}
        AND "startsAt" < ${now}
      GROUP BY 1
      ORDER BY 1`,
    db.booking.findMany({
      where: { businessId: business.id, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] }, startsAt: { gte: now } },
      include: { service: true },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
  ]);

  const byWeek = new Map(weeklyRows.map((r) => [new Date(r.week).toISOString().slice(0, 10), r]));
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const week = addDays(firstWeek, i * 7);
    const row = byWeek.get(week);
    return { week, revenueCents: row?.revenue ?? 0, count: row?.count ?? 0 };
  });

  const total = recent.reduce((sum, r) => sum + r._count, 0);
  const cancelled = recent.find((r) => r.status === "CANCELLED")?._count ?? 0;

  return {
    upcomingCount,
    monthRevenueCents: monthAgg._sum.priceCents ?? 0,
    monthBookings: monthAgg._count,
    cancellationRate: total ? cancelled / total : 0,
    weekly,
    next,
  };
}
