// TODO §20.3 — événements analytics autorisés (agrégés, jamais de PII sensible).
export const ANALYTICS_EVENTS = [
  "page_view",
  "trip_view",
  "trip_filter",
  "apply_start",
  "apply_submit",
  "checkout_start",
  "payment_start",
  "purchase",
  "contact_submit",
  "newsletter_signup",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const SAFE_PROP_KEYS = ["tripId", "locale", "page"] as const;

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}

export function sanitizeAnalyticsProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {};
  const out: Record<string, unknown> = {};
  for (const key of SAFE_PROP_KEYS) {
    const value = props[key];
    if (typeof value === "string" && value.length <= 160) out[key] = value;
  }
  return out;
}

export function trackAnalytics(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  console.log(JSON.stringify({ type: "analytics", event, ...sanitizeAnalyticsProps(props), timestamp: new Date().toISOString() }));
}
