import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/login");
  return user;
}

/** The signed-in owner's business; sends them to onboarding if they have none yet. */
export async function requireBusiness() {
  const user = await requireUser();
  const business = await db.business.findUnique({ where: { ownerId: user.id } });
  if (!business) redirect("/onboarding");
  return { user, business };
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "my-business"
  );
}

export async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base).padEnd(3, "0");
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await db.business.findUnique({ where: { slug: candidate } }))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createBusinessFor(userId: string, name: string, timezone: string) {
  const business = await db.business.create({
    data: {
      ownerId: userId,
      name,
      slug: await uniqueSlug(name),
      timezone,
      // Sensible default: Mon-Fri 09:00-18:00 with a lunch break.
      availabilityRules: {
        create: [1, 2, 3, 4, 5].flatMap((weekday) => [
          { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
          { weekday, startMinute: 13 * 60, endMinute: 18 * 60 },
        ]),
      },
    },
  });
  return business;
}
