import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { bookingRequestSchema, fieldErrors, serviceSchema, slugSchema, weeklyRulesSchema } from "@/lib/validation";

const en = getDictionary("en").errors;
const pt = getDictionary("pt").errors;

describe("validation", () => {
  it("converts a decimal price into integer cents", () => {
    const parsed = serviceSchema.parse({ name: "Haircut", durationMin: "30", price: "35.5" });
    expect(parsed.price).toBe(3550);
    expect(parsed.durationMin).toBe(30);
  });

  it("accepts only URL-safe slugs", () => {
    expect(slugSchema.parse("Studio-Fade")).toBe("studio-fade");
    expect(slugSchema.safeParse("bad slug!").success).toBe(false);
    expect(slugSchema.safeParse("-edge").success).toBe(false);
  });

  it("rejects weekly ranges that end before they start", () => {
    expect(weeklyRulesSchema.safeParse([{ weekday: 1, startMinute: 600, endMinute: 540 }]).success).toBe(false);
    expect(weeklyRulesSchema.safeParse([{ weekday: 7, startMinute: 0, endMinute: 60 }]).success).toBe(false);
    expect(weeklyRulesSchema.safeParse([{ weekday: 1, startMinute: 540, endMinute: 1440 }]).success).toBe(true);
  });

  it("normalizes booking requests", () => {
    const parsed = bookingRequestSchema.parse({
      slug: "studio-fade",
      serviceId: "abc",
      start: "2026-03-16T12:00:00.000Z",
      customerName: "  Ana  ",
      customerEmail: "ANA@Example.com",
      customerPhone: "",
    });
    expect(parsed.customerName).toBe("Ana");
    expect(parsed.customerEmail).toBe("ana@example.com");
    expect(parsed.customerPhone).toBeNull();
  });

  it("produces localized field errors", () => {
    const result = bookingRequestSchema.safeParse({
      slug: "studio-fade",
      serviceId: "abc",
      start: "2026-03-16T12:00:00.000Z",
      customerName: "A",
      customerEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error, en)).toEqual({
      customerName: "Must be at least 2 characters.",
      customerEmail: "Enter a valid email address.",
    });
    expect(fieldErrors(result.error, pt).customerEmail).toBe("Informe um e-mail válido.");
  });
});
