CREATE TYPE "public"."docket_type" AS ENUM('loi', 'con', 'det', 'det_eqt', 'det_asc');--> statement-breakpoint
ALTER TABLE "dockets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "dockets" ALTER COLUMN "status" SET DEFAULT 'filed'::text;--> statement-breakpoint
DROP TYPE "public"."docket_status";--> statement-breakpoint
CREATE TYPE "public"."docket_status" AS ENUM('loi_filed', 'loi_expired', 'loi_converted', 'filed', 'under_review', 'desk_determination_issued', 'appeal_hearing_officer_pending', 'appeal_hearing_officer_decided', 'appeal_con_panel_pending', 'appeal_con_panel_decided', 'appeal_superior_court_pending', 'appeal_superior_court_decided', 'appeal_court_of_appeals_pending', 'appeal_court_of_appeals_decided', 'appeal_supreme_court_pending', 'appeal_supreme_court_decided', 'approved', 'denied', 'withdrawn', 'closed');--> statement-breakpoint
ALTER TABLE "dockets" ALTER COLUMN "status" SET DEFAULT 'filed'::"public"."docket_status";--> statement-breakpoint
ALTER TABLE "dockets" ALTER COLUMN "status" SET DATA TYPE "public"."docket_status" USING "status"::"public"."docket_status";--> statement-breakpoint
ALTER TABLE "dockets" ADD COLUMN "docket_type" "docket_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "dockets" ADD COLUMN "parent_docket_id" integer;--> statement-breakpoint
ALTER TABLE "dockets" ADD COLUMN "equipment_type" text;--> statement-breakpoint
ALTER TABLE "dockets" ADD COLUMN "bed_count" integer;--> statement-breakpoint
ALTER TABLE "dockets" ADD COLUMN "service_type" text;--> statement-breakpoint
ALTER TABLE "dockets" ADD CONSTRAINT "dockets_parent_docket_id_dockets_id_fk" FOREIGN KEY ("parent_docket_id") REFERENCES "public"."dockets"("id") ON DELETE set null ON UPDATE no action;