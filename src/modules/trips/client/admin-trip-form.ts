/**
 * Back-office voyage : fiche d'édition complète.
 *
 * Réunit les mutations de la fiche : faits, traductions, transitions de statut,
 * départs, révisions et réglages d'engagement. Chaque succès recharge la page,
 * la fiche étant rendue côté serveur et portant `expectedUpdatedAt` pour
 * l'optimisme.
 */
import { actions } from "astro:actions";
import type { Locale } from "@i18n/config";
import { toast } from "@atoms/toast";
import { confirmAdminAction } from "@/core/admin";

/** Valeur numérique, ou `undefined` si le champ est vide. */
const num = (value: FormDataEntryValue | null): number | undefined =>
  value === "" || value == null ? undefined : Number(value);

/** Valeur texte, ou `undefined` si le champ est vide. */
const str = (value: FormDataEntryValue | null): string | undefined => {
  const text = String(value ?? "");
  return text === "" ? undefined : text;
};

/** Idem, mais `null` : certains champs doivent être explicitement effacés. */
const nullable = (value: FormDataEntryValue | null): string | null => {
  const text = String(value ?? "");
  return text === "" ? null : text;
};

/** Date ISO en UTC, ou `null` si le champ est vide. */
const dateOrNull = (value: FormDataEntryValue | null): Date | null => {
  const text = String(value ?? "");
  return text ? new Date(`${text}T00:00:00.000Z`) : null;
};

const currentForm = (event: Event): HTMLFormElement | null =>
  event.currentTarget as HTMLFormElement | null;

/** Raison d'échec côté client : JSON avancé invalide, ou early bird activé sans valeur. */
type PricingRulesResult =
  | { ok: true; rules: Record<string, unknown> }
  | { ok: false; reason: "invalidJson" | "earlyBirdValue" };

/** Construit `pricingRules` : JSON avancé + superposition des champs early bird
 *  dédiés. Les champs dédiés restent la source de vérité : toute clé `earlyBird*`
 *  du JSON avancé est retirée avant la fusion (early bird %/fixe exclusifs). */
function parsePricingRules(data: FormData): PricingRulesResult {
  let rules: Record<string, unknown>;
  try {
    const raw = String(data.get("pricingRules") ?? "{}").trim() || "{}";
    rules = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "invalidJson" };
  }
  for (const key of Object.keys(rules)) {
    if (key.startsWith("earlyBird")) delete rules[key];
  }
  if (data.get("earlyBirdEnabled") != null) {
    const kind = String(data.get("earlyBirdKind") ?? "percent");
    if (kind === "fixed") {
      const fixed = data.get("earlyBirdFixed");
      if (fixed == null || String(fixed).trim() === "") return { ok: false, reason: "earlyBirdValue" };
      rules.earlyBirdAmountFixed = Math.max(0, Math.round(Number(fixed)));
    } else {
      const percent = Number(data.get("earlyBirdPercent") ?? NaN);
      if (!Number.isFinite(percent) || percent <= 0) return { ok: false, reason: "earlyBirdValue" };
      rules.earlyBirdPercent = Math.min(100, Math.max(1, Math.round(percent)));
    }
    // Fenêtre bornée : N mois calendaires avant le départ, 4 par défaut (clamp).
    const months = Number(data.get("earlyBirdMonths"));
    rules.earlyBirdMonths = Number.isFinite(months) ? Math.min(24, Math.max(1, Math.round(months))) : 4;
    rules.earlyBirdFullPayment = data.get("earlyBirdFullPayment") != null;
  }
  return { ok: true, rules };
}

/** Actions déclenchées par un bouton de transition, indexées par état cible. */
type TransitionAction = () => ReturnType<typeof actions.publishTrip>;

export function initAdminTripForm(): void {
  const root = document.querySelector<HTMLElement>("[data-trip-form]");
  if (!root || root.dataset.bound === "true") return;
  root.dataset.bound = "true";

  const tripId = root.dataset.tripId ?? "";
  const labels = root.querySelector<HTMLElement>("[data-trip-form-i18n]");
  const errorPrefix = labels?.dataset.errorPrefix ?? "";

  /** Affiche le message d'erreur dans le formulaire et en toast. */
  const say = (form: HTMLFormElement | null, ok: boolean, text: string): void => {
    const element = form?.querySelector<HTMLElement>("[data-form-message]");
    if (element) element.textContent = ok ? "" : errorPrefix + text;
    if (!ok) toast.error(errorPrefix + text);
  };

  const toastError = (message: string | null | undefined): void => {
    toast.error(message ?? labels?.dataset.error ?? "");
  };

  const ask = async (message: string): Promise<boolean> =>
    confirmAdminAction({
      title: message,
      message,
      confirmLabel: labels?.dataset.confirmLabel ?? "OK",
      cancelLabel: labels?.dataset.cancelLabel ?? "",
    });

  const reload = (): void => {
    window.location.reload();
  };

  // ── Faits ────────────────────────────────────────────────────────────────
  const factsForm = root.querySelector<HTMLFormElement>("[data-facts-form]");
  if (factsForm) {
    factsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = currentForm(event);
      if (!form) return;
      const data = new FormData(form);
      const { error } = await actions.updateTrip({
        id: tripId,
        expectedUpdatedAt: String(data.get("expectedUpdatedAt") ?? "") || null,
        countryCode: str(data.get("countryCode"))?.toUpperCase(),
        defaultCurrency: str(data.get("defaultCurrency"))?.toUpperCase(),
        durationDays: num(data.get("durationDays")),
        durationNights: num(data.get("durationNights")),
        groupMin: num(data.get("groupMin")),
        groupMax: num(data.get("groupMax")),
        difficulty: str(data.get("difficulty")),
        difficultyLevel: num(data.get("difficultyLevel")),
        arrivalAirport: nullable(data.get("arrivalAirport")),
        departureAirport: nullable(data.get("departureAirport")),
        accommodationStyle: nullable(data.get("accommodationStyle")),
      });
      if (error) say(form, false, error.message);
      else reload();
    });
  }

  // ── Traductions ──────────────────────────────────────────────────────────
  root.querySelectorAll<HTMLFormElement>("[data-translation-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = currentForm(event);
      if (!target) return;
      const data = new FormData(target);
      const locale = (target.getAttribute("data-translation-form") ?? "") as Locale;
      const { error } = await actions.upsertTripTranslation({
        tripId,
        expectedUpdatedAt: String(data.get("expectedUpdatedAt") ?? "") || null,
        locale,
        slug: String(data.get("slug") ?? ""),
        title: String(data.get("title") ?? ""),
        shortTitle: str(data.get("shortTitle")) ?? null,
        summary: String(data.get("summary") ?? ""),
        overview: String(data.get("overview") ?? ""),
        metaTitle: str(data.get("metaTitle")) ?? null,
        metaDescription: str(data.get("metaDescription")) ?? null,
        localeVisible:
          target.querySelector<HTMLInputElement>('input[name="localeVisible"]')?.checked ?? false,
      });
      if (error) say(target, false, error.message);
      else reload();
    });
  });

  // ── Transitions de statut ────────────────────────────────────────────────
  const transitionActions: Record<string, TransitionAction> = {
    review: () => actions.submitTripForReview({ id: tripId }),
    approved: () => actions.approveTrip({ id: tripId }),
    published: () => actions.publishTrip({ id: tripId }),
    unpublished: () => actions.unpublishTrip({ id: tripId }),
    archived: () => actions.archiveTrip({ id: tripId }),
    restored: () => actions.restoreTrip({ id: tripId }),
    draft: () => actions.sendTripBackToDraft({ id: tripId }),
  };

  root.querySelectorAll<HTMLButtonElement>("[data-transition]").forEach((button) => {
    button.addEventListener("click", async () => {
      const run = transitionActions[button.getAttribute("data-transition") ?? ""];
      if (!run) return;
      const message = button.dataset.confirm ?? "";
      if (message && !(await ask(message))) return;
      const { error } = await run();
      if (error) toastError(error.message);
      else {
        toast.success(labels?.dataset.saved ?? "");
        reload();
      }
    });
  });

  // ── Statut d'un départ ───────────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-departure-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const row = button.closest<HTMLElement>("[data-departure-id]");
      const id = row?.dataset.departureId ?? "";
      const to = row?.querySelector<HTMLSelectElement>("[data-departure-status]")?.value ?? "";
      const { error } = await actions.setDepartureStatus({ id, to: to as "open" });
      if (error) toastError(error.message);
      else reload();
    });
  });

  // ── Restauration d'une révision ─────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>("[data-restore]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.closest<HTMLElement>("[data-revision-id]")?.dataset.revisionId ?? "";
      if (!id) return;
      const message = button.dataset.confirm ?? "";
      if (message && !(await ask(message))) return;
      const { error } = await actions.restoreTripRevision({ id });
      if (error) toastError(error.message);
      else reload();
    });
  });

  // ── Tarification d'un départ ─────────────────────────────────────────────
  root.querySelectorAll<HTMLFormElement>("[data-departure-edit]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = currentForm(event);
      if (!target) return;
      const id = target.closest<HTMLElement>("[data-departure-id]")?.dataset.departureId ?? "";
      const data = new FormData(target);

      const rulesResult = parsePricingRules(data);
      if (!rulesResult.ok) {
        const text = rulesResult.reason === "invalidJson"
          ? labels?.dataset.invalidJson ?? ""
          : labels?.dataset.earlyBirdValue ?? "";
        say(target, false, text);
        return;
      }

      const { error } = await actions.updateDeparture({
        id,
        expectedUpdatedAt: String(data.get("expectedUpdatedAt") ?? "") || null,
        startDate: dateOrNull(data.get("startDate")) ?? undefined,
        endDate: dateOrNull(data.get("endDate")) ?? undefined,
        capacityMin: num(data.get("capacityMin")),
        capacityMax: num(data.get("capacityMax")),
        priceAmount: num(data.get("priceAmount")),
        currency: str(data.get("currency")),
        depositAmount: num(data.get("depositAmount")),
        depositType: (String(data.get("depositType") ?? "none") || "none") as
          | "fixed"
          | "percent"
          | "none",
        depositPercent: num(data.get("depositPercent")),
        singleSupplementAmount: num(data.get("singleSupplementAmount")),
        taxAmount: num(data.get("taxAmount")),
        feeAmount: num(data.get("feeAmount")),
        discountAmount: num(data.get("discountAmount")),
        balanceDueDate: dateOrNull(data.get("balanceDueDate")),
        bookingDeadline: dateOrNull(data.get("bookingDeadline")),
        pricingRules: rulesResult.rules,
      });
      if (error) say(target, false, error.message);
      else reload();
    });
  });

  // ── Réglages d'engagement ────────────────────────────────────────────────
  const engagementForm = root.querySelector<HTMLFormElement>("[data-engagement-form]");
  if (engagementForm) {
    engagementForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = currentForm(event);
      if (!form) return;
      const data = new FormData(form);
      const { error } = await actions.updateTripEngagementSettings({
        tripId,
        commentStatus: String(data.get("commentStatus") ?? "OPEN") as
          | "OPEN"
          | "CLOSED"
          | "DISABLED",
        allowReviews:
          form.querySelector<HTMLInputElement>('input[name="allowReviews"]')?.checked ?? true,
      });
      if (error) say(form, false, error.message);
      else reload();
    });
  }

  // ── Création d'un départ ─────────────────────────────────────────────────
  const departureForm = root.querySelector<HTMLFormElement>("[data-departure-form]");
  if (departureForm) {
    departureForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = currentForm(event);
      if (!form) return;
      const data = new FormData(form);
      const rulesResult = parsePricingRules(data);
      if (!rulesResult.ok) {
        const text = rulesResult.reason === "invalidJson"
          ? labels?.dataset.invalidJson ?? ""
          : labels?.dataset.earlyBirdValue ?? "";
        say(form, false, text);
        return;
      }
      const { error } = await actions.createDeparture({
        tripId,
        startDate: new Date(String(data.get("startDate"))),
        endDate: new Date(String(data.get("endDate"))),
        capacityMin: Number(data.get("capacityMin")),
        capacityMax: Number(data.get("capacityMax")),
        priceAmount: Number(data.get("priceAmount")),
        currency: String(data.get("currency") || "EUR"),
        pricingRules: rulesResult.rules,
      });
      if (error) say(form, false, error.message);
      else reload();
    });
  }
}
