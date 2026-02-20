CREATE TYPE "public"."user_role" AS ENUM('admin', 'attorney');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'attorney' NOT NULL;