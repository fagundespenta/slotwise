/**
 * Demo data: one barbershop with services, opening hours, a day off and
 * ~10 weeks of bookings so the dashboard charts have something to show.
 *
 *   npm run db:seed
 *
 * Login: demo@slotwise.app / demo1234   ·   Public page: /b/studio-fade
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { getAvailableSlots } from "../src/lib/slots";
import { addDays, todayIn } from "../src/lib/time";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Deterministic pseudo-random numbers so every seed run looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const TZ = "America/Sao_Paulo";
const customers = [
  ["Ana Souza", "ana.souza@example.com"],
  ["Bruno Lima", "bruno.lima@example.com"],
  ["Carla Mendes", "carla@example.com"],
  ["Diego Rocha", "diego.rocha@example.com"],
  ["Emily Carter", "emily.carter@example.com"],
  ["Felipe Santos", "felipe@example.com"],
  ["Gabriel Alves", "gabriel.alves@example.com"],
  ["Helena Costa", "helena@example.com"],
  ["Igor Martins", "igor.m@example.com"],
  ["Julia Ferreira", "julia.ferreira@example.com"],
  ["Lucas Oliveira", "lucas.o@example.com"],
  ["Mariana Ribeiro", "mari.ribeiro@example.com"],
  ["Noah Smith", "noah.smith@example.com"],
  ["Rafael Gomes", "rafa.gomes@example.com"],
] as const;

async function main() {
  await db.user.deleteMany({ where: { email: "demo@slotwise.app" } });

  const user = await db.user.create({
    data: { email: "demo@slotwise.app", name: "Demo Owner", passwordHash: await bcrypt.hash("demo1234", 10) },
  });

  const business = await db.business.create({
    data: {
      ownerId: user.id,
      name: "Studio Fade Barbershop",
      slug: "studio-fade",
      description: "Classic cuts, skin fades and hot-towel shaves in Pinheiros, São Paulo.",
      timezone: TZ,
      currency: "usd",
      depositPercent: 20,
      minNoticeMinutes: 60,
      maxAdvanceDays: 30,
      availabilityRules: {
        create: [
          // Tue–Fri 09:00–12:00 and 13:00–19:00, Sat 09:00–15:00
          ...[2, 3, 4, 5].flatMap((weekday) => [
            { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
            { weekday, startMinute: 13 * 60, endMinute: 19 * 60 },
          ]),
          { weekday: 6, startMinute: 9 * 60, endMinute: 15 * 60 },
        ],
      },
    },
  });

  const services = await Promise.all(
    [
      { name: "Haircut", description: "Scissor or clipper cut, wash and style.", durationMin: 30, priceCents: 2500 },
      { name: "Haircut + Beard", description: "Full cut plus beard trim and line-up.", durationMin: 45, priceCents: 3500 },
      { name: "Skin Fade", description: "Detailed fade with foil shaver finish.", durationMin: 45, priceCents: 3000 },
      { name: "Hot Towel Shave", description: "Traditional straight-razor shave.", durationMin: 30, priceCents: 2000 },
      { name: "Kids Cut", description: "Under 12.", durationMin: 30, priceCents: 1800 },
    ].map((s) => db.service.create({ data: { ...s, businessId: business.id } })),
  );

  const today = todayIn(TZ);
  await db.blockedDate.create({ data: { businessId: business.id, date: addDays(today, 9), reason: "Barber convention" } });

  const rules = await db.availabilityRule.findMany({ where: { businessId: business.id } });
  const now = new Date();
  const busy: { start: Date; end: Date }[] = [];
  let created = 0;

  // Walk from 10 weeks ago to 2 weeks ahead and fill a share of the free slots.
  for (let offset = -70; offset <= 14; offset++) {
    const date = addDays(today, offset);
    if (offset === 9) continue;
    const fillRate = offset < 0 ? 0.35 + 0.25 * ((offset + 70) / 70) : 0.3; // business is growing
    for (let i = 0; i < 12; i++) {
      const service = pick(services);
      const slots = getAvailableSlots({
        date,
        timeZone: TZ,
        rules,
        busy,
        durationMin: service.durationMin,
        stepMin: 30,
        now: offset < 0 ? new Date(0) : now,
      });
      if (slots.length === 0 || rand() > fillRate) continue;
      const slot = pick(slots);
      busy.push(slot);
      const [customerName, customerEmail] = pick([...customers]);
      const cancelled = rand() < 0.08;
      const isFuture = slot.start > now;
      const paidDeposit = rand() < 0.5;
      await db.booking.create({
        data: {
          businessId: business.id,
          serviceId: service.id,
          customerName,
          customerEmail,
          customerPhone: rand() < 0.6 ? `+55 11 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}` : null,
          startsAt: slot.start,
          endsAt: slot.end,
          priceCents: service.priceCents,
          depositCents: paidDeposit ? Math.round(service.priceCents * 0.2) : 0,
          depositPaid: paidDeposit,
          status: cancelled ? "CANCELLED" : "CONFIRMED",
          cancelledAt: cancelled ? new Date(slot.start.getTime() - 86_400_000) : null,
          manageToken: randomBytes(24).toString("base64url"),
          createdAt: new Date(Math.min(now.getTime(), slot.start.getTime() - (isFuture ? 2 : 5) * 86_400_000)),
        },
      });
      created++;
    }
  }

  console.log(`Seeded "${business.name}" with ${services.length} services and ${created} bookings.`);
  console.log("Login: demo@slotwise.app / demo1234 · Public page: /b/studio-fade");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
