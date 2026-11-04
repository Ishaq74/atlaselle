import type { Locale } from "@/i18n/config";

export interface SuccessContext {
  locale: Locale;
  url: URL;
}

export interface SuccessOutcome {
  /** Chemin same-origin ("/…") ou URL http(s) absolue (ex. page de paiement). */
  redirectTo?: string;
  /** Remplace le message de succès générique. */
  message?: string;
}

export type SuccessPolicy = (data: unknown, ctx: SuccessContext) => SuccessOutcome | void;

const APPLICATION_MESSAGES: Record<Locale, { sent: string; waitlisted: string }> = {
  fr: { sent: "Candidature enregistrée. Consultez votre e-mail pour la suite.", waitlisted: "Départ complet : votre demande est inscrite sur la liste d'attente." },
  es: { sent: "Solicitud registrada. Consulte su correo para continuar.", waitlisted: "La salida está completa: su solicitud está en la lista de espera." },
  ar: { sent: "تم تسجيل الطلب. تحقق من بريدك الإلكتروني للمتابعة.", waitlisted: "اكتمل موعد الرحلة: أُضيف طلبك إلى قائمة الانتظار." },
  en: { sent: "Application recorded. Check your email for next steps.", waitlisted: "This departure is full; your request is on the waiting list." },
};

const toPaymentPage: SuccessPolicy = (data) => {
  const checkoutUrl = (data as { checkoutUrl?: unknown } | null | undefined)?.checkoutUrl;
  return typeof checkoutUrl === "string" ? { redirectTo: checkoutUrl } : undefined;
};

function redirectToCreated(data: unknown, base: string, suffix = ""): SuccessOutcome | undefined {
  const id = (data as { id?: unknown } | null | undefined)?.id;
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? { redirectTo: `${base}/${id}${suffix}` } : undefined;
}

/**
 * Comportement après un succès natif, quand il diffère du simple « retour sur la
 * page courante + message ». Miroir de ce que fait le gestionnaire JavaScript du
 * formulaire (redirection vers le paiement, page de confirmation…).
 * Clé = nom de l'action dans `src/actions/index.ts`.
 */
export const SUCCESS_POLICIES: Record<string, SuccessPolicy> = {
  // Place disponible : page de paiement ; sinon (liste d'attente / paiement différé) message.
  submitApplication: (data, ctx) => {
    const result = data as { status?: string; checkoutUrl?: unknown } | null | undefined;
    if (typeof result?.checkoutUrl === "string") return { redirectTo: result.checkoutUrl };
    const messages = APPLICATION_MESSAGES[ctx.locale] ?? APPLICATION_MESSAGES.en;
    return { message: result?.status === "waitlisted" ? messages.waitlisted : messages.sent };
  },
  initiateCheckout: toPaymentPage,
  payBalance: toPaymentPage,
  // Création d'un contenu : ouverture de sa page d'édition (comme le JS).
  createBlogPost: (data, ctx) => redirectToCreated(data, `/${ctx.locale}/admin/blog`, "/edit"),
  createService: (data, ctx) => redirectToCreated(data, `/${ctx.locale}/admin/services`, "/edit"),
  createTrip: (data, ctx) => redirectToCreated(data, ctx.url.pathname.replace(/\/$/, "")),
};

export function isSafeRedirect(target: unknown): target is string {
  if (typeof target !== "string" || target.length === 0 || target.length > 2048) return false;
  if (/[\r\n]/.test(target)) return false;
  if (target.startsWith("/")) return !target.startsWith("//") && !target.startsWith("/\\");
  try {
    const parsed = new URL(target);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
