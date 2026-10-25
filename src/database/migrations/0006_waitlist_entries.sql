CREATE TABLE "waitlist_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "application_id" text NOT NULL,
  "departure_id" text NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "offered_at" timestamp,
  "expires_at" timestamp,
  "promoted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "waitlist_entries_status_ck" CHECK ("status" IN ('waiting', 'offered', 'promoted', 'expired', 'removed')),
  CONSTRAINT "waitlist_entries_application_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE,
  CONSTRAINT "waitlist_entries_departure_fk" FOREIGN KEY ("departure_id") REFERENCES "departures"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_application_uidx" ON "waitlist_entries" USING btree ("application_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_one_offer_per_departure_uidx" ON "waitlist_entries" USING btree ("departure_id") WHERE "status" = 'offered';
--> statement-breakpoint
CREATE INDEX "waitlist_fifo_idx" ON "waitlist_entries" USING btree ("departure_id", "status", "joined_at", "id");
--> statement-breakpoint
CREATE INDEX "waitlist_offer_expiry_idx" ON "waitlist_entries" USING btree ("status", "expires_at");
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "dedupe_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_dedupe_key_uidx" ON "email_deliveries" USING btree ("dedupe_key");
