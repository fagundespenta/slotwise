import { z } from "zod";
import { isValidIsoDate, isValidTimeZone } from "./time";

const email = z.string().trim().toLowerCase().email().max(200);

export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(8).max(200),
  businessName: z.string().trim().min(2).max(80),
  timezone: z.string().refine(isValidTimeZone, "Invalid timezone"),
});

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  timezone: z.string().refine(isValidTimeZone, "Invalid timezone"),
  currency: z.enum(["usd", "brl", "eur"]),
  depositPercent: z.coerce.number().int().min(0).max(100),
  minNoticeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 7),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
});

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  timezone: z.string().refine(isValidTimeZone, "Invalid timezone"),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  durationMin: z.coerce.number().int().min(5).max(8 * 60),
  // Price typed by the owner in major units ("35.50") → cents.
  price: z.coerce
    .number()
    .min(0)
    .max(100_000)
    .transform((v) => Math.round(v * 100)),
});

const minuteOfDay = z.number().int().min(0).max(1440);

export const weeklyRulesSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), startMinute: minuteOfDay, endMinute: minuteOfDay })
      .refine((r) => r.endMinute > r.startMinute, "End must be after start"),
  )
  .max(50);

export const blockedDateSchema = z.object({
  date: z.string().refine(isValidIsoDate, "Invalid date"),
  reason: z.string().trim().max(120).optional().transform((v) => v || null),
});

export const slotsQuerySchema = z.object({
  slug: slugSchema,
  serviceId: z.string().min(1).max(40),
  date: z.string().refine(isValidIsoDate, "Invalid date"),
});

export const bookingRequestSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().min(1).max(40),
  start: z.iso.datetime(),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: email,
  customerPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/, "Invalid phone")
    .optional()
    .transform((v) => v || null),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export type ErrorMessages = {
  required: string;
  tooShort: string;
  tooLong: string;
  tooSmall: string;
  tooBig: string;
  email: string;
  invalid: string;
  slug: string;
};

const fill = (template: string, vars: Record<string, unknown>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));

/** Turns one Zod issue into a human message in the user's language. */
export function issueMessage(issue: z.core.$ZodIssue, m: ErrorMessages): string {
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") return Number(issue.minimum) <= 1 ? m.required : fill(m.tooShort, { min: issue.minimum });
      return fill(m.tooSmall, { min: issue.minimum });
    case "too_big":
      return fill(issue.origin === "string" ? m.tooLong : m.tooBig, { max: issue.maximum });
    case "invalid_format":
      if (issue.format === "email") return m.email;
      if (issue.format === "regex" && issue.path.at(-1) === "slug") return m.slug;
      return m.invalid;
    case "invalid_type":
      return issue.input === undefined ? m.required : m.invalid;
    default:
      return m.invalid;
  }
}

/** Flattens Zod issues into `{ field: firstMessage }` for form display. */
export function fieldErrors(error: z.ZodError, messages: ErrorMessages): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issueMessage(issue, messages);
  }
  return out;
}
