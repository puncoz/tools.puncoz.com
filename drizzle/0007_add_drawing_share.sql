ALTER TABLE "drawings" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "drawings" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "drawings_share_token_idx" ON "drawings" USING btree ("share_token");