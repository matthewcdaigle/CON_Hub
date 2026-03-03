CREATE TYPE "public"."docket_status" AS ENUM('pre_filing', 'filed', 'under_review', 'hearing_scheduled', 'hearing_complete', 'decision_pending', 'approved', 'denied', 'withdrawn', 'appealed');--> statement-breakpoint
CREATE TABLE "docket_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"docket_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" timestamp NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docket_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"docket_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dockets" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_number" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"applicant" text NOT NULL,
	"facility_name" text NOT NULL,
	"facility_type" text NOT NULL,
	"county" text NOT NULL,
	"status" "docket_status" DEFAULT 'filed' NOT NULL,
	"filing_date" timestamp NOT NULL,
	"hearing_date" timestamp,
	"decision_date" timestamp,
	"description" text,
	"estimated_cost" text,
	"laserfiche_url" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "dockets_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "draft_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"template_content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"docket_id" integer,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"content" text,
	"tags" text[],
	"source_url" text,
	"laserfiche_url" text,
	"related_docket_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"template_id" integer,
	"docket_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docket_events" ADD CONSTRAINT "docket_events_docket_id_dockets_id_fk" FOREIGN KEY ("docket_id") REFERENCES "public"."dockets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docket_subscriptions" ADD CONSTRAINT "docket_subscriptions_docket_id_dockets_id_fk" FOREIGN KEY ("docket_id") REFERENCES "public"."dockets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_docket_id_dockets_id_fk" FOREIGN KEY ("docket_id") REFERENCES "public"."dockets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_related_docket_id_dockets_id_fk" FOREIGN KEY ("related_docket_id") REFERENCES "public"."dockets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_drafts" ADD CONSTRAINT "saved_drafts_template_id_draft_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."draft_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_drafts" ADD CONSTRAINT "saved_drafts_docket_id_dockets_id_fk" FOREIGN KEY ("docket_id") REFERENCES "public"."dockets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docket_events_docket_id_idx" ON "docket_events" USING btree ("docket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "docket_subscriptions_user_docket_idx" ON "docket_subscriptions" USING btree ("user_id","docket_id");--> statement-breakpoint
CREATE INDEX "docket_subscriptions_user_id_idx" ON "docket_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dockets_status_idx" ON "dockets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dockets_county_idx" ON "dockets" USING btree ("county");--> statement-breakpoint
CREATE INDEX "dockets_filing_date_idx" ON "dockets" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "research_documents_category_idx" ON "research_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "saved_drafts_user_id_idx" ON "saved_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");