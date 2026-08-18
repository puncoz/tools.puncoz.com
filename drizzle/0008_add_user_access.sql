CREATE TABLE "user_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "workos_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_reapplied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_access_events" ADD CONSTRAINT "user_access_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_events" ADD CONSTRAINT "user_access_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_access_events_user_idx" ON "user_access_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint

-- Addresses are lowercased on write from here on, so existing rows are
-- normalised BEFORE the unique index exists. Doing it afterwards could fail on a
-- pair that differs only in case.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_access_status_idx" ON "users" USING btree ("access_status");--> statement-breakpoint

-- GRANDFATHERING. The column defaults to 'pending', which is right for anyone
-- signing up from now on and catastrophic for anyone already here: without this
-- line, deploying locks every existing account — including the owner's — out of
-- data it already holds. Scoped to rows that predate the column.
UPDATE "users" SET
	"access_status" = 'approved',
	"access_reviewed_at" = now();--> statement-breakpoint

-- Matches every other table: RLS on, zero policies. The app reaches Postgres
-- directly and bypasses RLS; this only makes the table unreachable through
-- Supabase's PostgREST anon key.
ALTER TABLE "user_access_events" ENABLE ROW LEVEL SECURITY;
