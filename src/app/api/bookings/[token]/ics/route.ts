import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** GET /api/bookings/:token/ics → calendar file for the customer. */
export async function GET(_req: Request, ctx: RouteContext<"/api/bookings/[token]/ics">) {
  const { token } = await ctx.params;
  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    include: { service: true, business: true },
  });
  if (!booking || booking.status === "CANCELLED") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Slotwise//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@slotwise`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(booking.startsAt)}`,
    `DTEND:${icsDate(booking.endsAt)}`,
    `SUMMARY:${escape(`${booking.service.name} — ${booking.business.name}`)}`,
    `DESCRIPTION:${escape(`Manage or cancel: ${appUrl()}/booking/${booking.manageToken}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${booking.id}.ics"`,
    },
  });
}
