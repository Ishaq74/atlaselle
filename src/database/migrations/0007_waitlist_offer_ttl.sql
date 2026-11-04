ALTER TABLE "departures" ADD COLUMN "waitlist_offer_ttl_hours" integer DEFAULT 48 NOT NULL;
--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_waitlist_offer_ttl_ck" CHECK ("waitlist_offer_ttl_hours" BETWEEN 1 AND 720);
--> statement-breakpoint
-- Plusieurs places libres ⇒ plusieurs propositions simultanées (une par candidat : waitlist_application_uidx).
DROP INDEX IF EXISTS "waitlist_one_offer_per_departure_uidx";
