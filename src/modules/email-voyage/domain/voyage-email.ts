import { eq } from "drizzle-orm";
import { getDrizzle } from "@database/drizzle";
import { emailDeliveries, emailEvents } from "@database/schemas";
import type { VoyageEmailTemplate } from "@database/schemas/email-voyage.schema";
import { sendEmail } from "@smtp/send";
import { voyageTemplate, type VoyageEmailVars } from "@smtp/templates/voyage";
import { isValidLocale, type Locale } from "@/i18n/utils";

export type SendFn = (payload: { to: string; subject: string; html: string; text: string }) => Promise<void>;

export interface SendVoyageEmailInput {
  template: VoyageEmailTemplate;
  locale: Locale;
  toEmail: string;
  travelerId?: string | null;
  reservationId?: string | null;
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
  const [delivery] = await db
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
  if (!delivery) throw new Error("Delivery creation failed");
  try {
    await sender({ to: input.toEmail, subject, html, text });
    await db.update(emailDeliveries).set({ status: "sent", sentAt: new Date() }).where(eq(emailDeliveries.id, delivery.id));
    await db.insert(emailEvents).values({ deliveryId: delivery.id, event: "sent" });
    return { deliveryId: delivery.id, sent: true };
  } catch (err) {
    await db
      .update(emailDeliveries)
      .set({ status: "failed", lastError: err instanceof Error ? err.message.slice(0, 500) : "unknown" })
      .where(eq(emailDeliveries.id, delivery.id));
    await db.insert(emailEvents).values({ deliveryId: delivery.id, event: "failed" });
    return { deliveryId: delivery.id, sent: false };
  }
}
