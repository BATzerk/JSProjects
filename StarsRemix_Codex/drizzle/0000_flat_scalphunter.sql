CREATE TABLE "community_boards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"author_name" varchar(80) NOT NULL,
	"title" varchar(80) NOT NULL,
	"puzzle" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"difficulty" jsonb NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "community_boards_fingerprint_unique" ON "community_boards" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "community_boards_owner_created_idx" ON "community_boards" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "community_boards_created_idx" ON "community_boards" USING btree ("created_at");