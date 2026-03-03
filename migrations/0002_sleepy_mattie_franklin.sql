CREATE TABLE "docket_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"docket_id" integer NOT NULL,
	"uploaded_by" varchar,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"document_type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docket_documents" ADD CONSTRAINT "docket_documents_docket_id_dockets_id_fk" FOREIGN KEY ("docket_id") REFERENCES "public"."dockets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docket_documents" ADD CONSTRAINT "docket_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docket_documents_docket_id_idx" ON "docket_documents" USING btree ("docket_id");