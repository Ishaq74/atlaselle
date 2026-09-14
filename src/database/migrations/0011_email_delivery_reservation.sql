ALTER TABLE "email_deliveries" ADD COLUMN "reservation_id" text;--> statement-breakpoint
CREATE INDEX "email_deliveries_reservation_idx" ON "email_deliveries" USING btree ("reservation_id");