import { and, eq, lt, sql } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { emailDeliveries, emailEvents } from "@database/schemas";
import type { VoyageEmailTemplate } from "@database/schemas/email-voyage.schema";
import { sendEmail } from "@smtp/send";
import { voyageTemplate, type VoyageEmailVars } from "@smtp/templates/voyage";
import { isValidLocale } from "@/i18n/utils";
import type { Locale } from "@/i18n/config";

export type SendFn = (payload: { to: string; subject: string; html: string; text: string }) => Promise<void>;

export interface SendVoyageEmailInput {
  template: VoyageEmailTemplate;
  locale: Locale;
  toEmail: string;
  travelerId?: string | null;
  reservationId?: string | null;
  dedupeKey?: string;
  vars?: VoyageEmailVars;
  url?: string;
}

// Envoi transactionnel voyage : rendu localisé + tracking en DB (TODO §14.1).
// `sender` injectable pour les tests (défaut = provider SMTP réel).
export async function sendVoyageEmail(
  input: SendVoyageEmailInput,
  sender: SendFn = sendEmail,
): Promise<{ deliveryId: string; sent: boolean }> {
  const locale = isValidLocale(input.locale) ? input.locale : "en";
  const { subject, html, text } = voyageTemplate(input.template, locale, input.vars ?? {}, input.url);
  const db = getDrizzle();
  let delivery: { id: string } | undefined;
  let retrying = false;
  if (input.dedupeKey) {
    [delivery] = await db
      .insert(emailDeliveries)
      .values({
        templateKey: input.template,
        locale,
        toEmail: input.toEmail,
        travelerId: input.travelerId ?? null,
        reservationId: input.reservationId ?? null,
        dedupeKey: input.dedupeKey,
        status: "sending",
      })
      .onConflictDoNothing({ target: emailDeliveries.dedupeKey })
      .returning({ id: emailDeliveries.id });
    if (!delivery) {
      const staleSendingBefore = new Date(Date.now() - 10 * 60_000);
      const [claimed] = await db
        .update(emailDeliveries)
        .set({ status: "sending", attempts: sql`${emailDeliveries.attempts} + 1`, lastError: null })
        .where(
          and(
            eq(emailDeliveries.dedupeKey, input.dedupeKey),
            eq(emailDeliveries.status, "failed"),
          ),
        )
        .returning({ id: emailDeliveries.id });
      if (claimed) {
        delivery = claimed;
        retrying = true;
      } else {
        const [existing] = await db
          .select({ id: emailDeliveries.id, status: emailDeliveries.status, updatedAt: emailDeliveries.updatedAt })
          .from(emailDeliveries)
          .where(eq(emailDeliveries.dedupeKey, input.dedupeKey))
          .limit(1);
        if (existing?.id && existing.status === "sent") {
          return { deliveryId: existing.id, sent: true };
        }
        if (existing?.status === "sending" && existing.id) {
          if (existing.updatedAt >= staleSendingBefore) return { deliveryId: existing.id, sent: true };
          const [recovered] = await db
            .update(emailDeliveries)
            .set({ attempts: sql`${emailDeliveries.attempts} + 1`, updatedAt: new Date() })
            .where(
              and(
                eq(emailDeliveries.id, existing.id),
                eq(emailDeliveries.status, "sending"),
                lt(emailDeliveries.updatedAt, staleSendingBefore),
              ),
            )
            .returning({ id: emailDeliveries.id });
          if (recovered) {
            delivery = recovered;
            retrying = true;
          }
        }
      }
    }
  } else {
    [delivery] = await db
      .insert(emailDeliveries)
      .values({
        templateKey: input.template,
        locale,
        toEmail: input.toEmail,
        travelerId: input.travelerId ?? null,
        reservationId: input.reservationId ?? null,
        status: "sending",
      })
      .returning({ id: emailDeliveries.id });
  }
  if (!delivery) throw new Error("Delivery creation failed");
  if (retrying) await db.insert(emailEvents).values({ deliveryId: delivery.id, event: "retrying" });
  try {
    await sender({ to: input.toEmail, subject, html, text });
    await db.update(emailDeliveries).set({ status: "sent", sentAt: new Date() }).where(eq(emailDeliveries.id, delivery.id));
    await db.insert(emailEvents).values({ deliveryId: delivery.id, event: "sent" });
    return { deliveryId: delivery.id, sent: true };
  } catch (err) {
    await db
      .update(emailDeliveries)
      .set({
        status: "failed",
        attempts: sql`${emailDeliveries.attempts} + 1`,
        lastError: err instanceof Error ? err.message.slice(0, 500) : "unknown",
      })
      .where(eq(emailDeliveries.id, delivery.id));
    await db.insert(emailEvents).values({ deliveryId: delivery.id, event: "failed" });
    return { deliveryId: delivery.id, sent: false };
  }
}
