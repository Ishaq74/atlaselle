import { ActionError, defineAction } from "astro:actions";
import { eq } from "drizzle-orm";
import { z } from "astro/zod";
import { getDrizzle } from "@database/drizzle";
import { departures } from "@database/schemas";
import { pricingRulesSchema } from "@/modules/pricing/domain/pricing";
import { assertTransitionDeparture } from "@/modules/departures/domain/departure-transitions";
import type { DepartureStatus } from "@database/schemas/departures.schema";
import { assertVoyagePermission, assertTripExists, assertFresh, auditVoyage, invalidateVoyageCache } from "./_helpers";

const amountField = z.number().int().min(0).optional();
const amountTypeField = z.enum(["fixed", "percent", "none"]).optional();

export const departureInput = z.object({
  tripId: z.string().min(1).max(160),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  capacityMin: z.number().int().positive(),
  capacityMax: z.number().int().positive(),
  priceAmount: z.number().int().min(0),
  currency: z.string().length(3).default("EUR"),
  depositType: amountTypeField,
  depositAmount: amountField,
  depositPercent: z.number().int().min(0).max(100).optional(),
  singleSupplementType: amountTypeField,
  singleSupplementAmount: amountField,
  taxType: amountTypeField,
  taxAmount: amountField,
  feeType: amountTypeField,
  feeAmount: amountField,
  discountType: amountTypeField,
  discountAmount: amountField,
  pricingRules: pricingRulesSchema.optional(),
  balanceDueDate: z.coerce.date().nullable().optional(),
  bookingDeadline: z.coerce.date().nullable().optional(),
  arrivalAirport: z.string().max(8).nullable().optional(),
  departureAirport: z.string().max(8).nullable().optional(),
});

function checkDepartureDates(start: Date, end: Date): void {
  if (end <= start) throw new ActionError({ code: "BAD_REQUEST", message: "La fin doit être après le début." });
}

export const createDeparture = defineAction({
  input: departureInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { departure: ["create"] });
    await assertTripExists(input.tripId);
    checkDepartureDates(input.startDate, input.endDate);
    if (input.capacityMax < input.capacityMin) {
      throw new ActionError({ code: "BAD_REQUEST", message: "capacityMax doit être ≥ capacityMin." });
    }
    const [created] = await getDrizzle().insert(departures).values({ ...input }).returning({ id: departures.id });
    if (!created) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Création du départ impossible." });
    auditVoyage(context, user.id, "DEPARTURE_CREATE", { resource: "departures", resourceId: created.id, metadata: { tripId: input.tripId } });
    invalidateVoyageCache();
    return { id: created.id };
  },
});

export const updateDeparture = defineAction({
  input: departureInput.partial().extend({ id: z.string().uuid(), expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional() }),
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { departure: ["update"] });
    const { id, expectedUpdatedAt, ...patch } = input;
    const [current] = await getDrizzle().select().from(departures).where(eq(departures.id, id)).limit(1);
    if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Départ introuvable." });
    assertFresh(current.updatedAt, expectedUpdatedAt ?? null, "Départ");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const start = (clean.startDate as Date | undefined) ?? current.startDate;
    const end = (clean.endDate as Date | undefined) ?? current.endDate;
    checkDepartureDates(start, end);
    await getDrizzle().update(departures).set(clean).where(eq(departures.id, id));
    auditVoyage(context, user.id, "DEPARTURE_UPDATE", { resource: "departures", resourceId: id, metadata: { fields: Object.keys(clean) } });
    invalidateVoyageCache();
    return { success: true };
  },
});

const departureStatusInput = z.object({ id: z.string().uuid(), to: z.enum(["open", "limited", "waitlist", "closed", "cancelled"]) });

export const setDepartureStatus = defineAction({
  input: departureStatusInput,
  handler: async (input, context) => {
    const user = await assertVoyagePermission(context, { departure: ["update"] });
    const [current] = await getDrizzle().select().from(departures).where(eq(departures.id, input.id)).limit(1);
    if (!current) throw new ActionError({ code: "NOT_FOUND", message: "Départ introuvable." });
    assertTransitionDeparture(current.status as DepartureStatus, input.to);
    await getDrizzle().update(departures).set({ status: input.to }).where(eq(departures.id, input.id));
    auditVoyage(context, user.id, "DEPARTURE_STATUS", {
      resource: "departures",
      resourceId: input.id,
      metadata: { from: current.status, to: input.to },
    });
    invalidateVoyageCache();
    return { success: true };
  },
});

export async function assertDepartureExists(departureId: string) {
  const [dep] = await getDrizzle().select().from(departures).where(eq(departures.id, departureId)).limit(1);
  if (!dep) throw new ActionError({ code: "NOT_FOUND", message: "Départ introuvable." });
  return dep;
}
