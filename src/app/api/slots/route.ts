import { NextResponse, type NextRequest } from "next/server";
import { slotsQuerySchema } from "@/lib/validation";
import { getSlotsFor } from "@/server/booking";

/** GET /api/slots?slug=...&serviceId=...&date=YYYY-MM-DD → available UTC slots. */
export async function GET(req: NextRequest) {
  const parsed = slotsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const result = await getSlotsFor(parsed.data.slug, parsed.data.serviceId, parsed.data.date);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    {
      timeZone: result.business.timezone,
      slots: result.slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
