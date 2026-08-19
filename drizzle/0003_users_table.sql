CREATE TYPE "public"."user_role" AS ENUM('customer', 'seller');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "users_created_at_id_idx" ON "users" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);