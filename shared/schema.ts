import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, pgEnum, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";
import { users } from "./models/auth";

export const docketStatusEnum = pgEnum("docket_status", [
  "loi_filed",
  "loi_expired",
  "loi_converted",
  "filed",
  "under_review",
  "desk_determination_issued",
  "appeal_hearing_officer_pending",
  "appeal_hearing_officer_decided",
  "appeal_con_panel_pending",
  "appeal_con_panel_decided",
  "appeal_superior_court_pending",
  "appeal_superior_court_decided",
  "appeal_court_of_appeals_pending",
  "appeal_court_of_appeals_decided",
  "appeal_supreme_court_pending",
  "appeal_supreme_court_decided",
  "approved",
  "denied",
  "withdrawn",
  "closed",
]);

export const docketTypeEnum = pgEnum("docket_type", [
  "loi",
  "con",
  "det",
  "det_eqt",
  "det_asc",
]);

export const dockets = pgTable("dockets", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  applicant: text("applicant").notNull(),
  facilityName: text("facility_name").notNull(),
  facilityType: text("facility_type").notNull(),
  county: text("county").notNull(),
  docketType: docketTypeEnum("docket_type").notNull(),
  status: docketStatusEnum("status").notNull().default("filed"),
  parentDocketId: integer("parent_docket_id").references((): any => dockets.id, { onDelete: "set null" }),
  filingDate: timestamp("filing_date").notNull(),
  hearingDate: timestamp("hearing_date"),
  decisionDate: timestamp("decision_date"),
  description: text("description"),
  estimatedCost: text("estimated_cost"),
  laserficheUrl: text("laserfiche_url"),
  equipmentType: text("equipment_type"),
  bedCount: integer("bed_count"),
  serviceType: text("service_type"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("dockets_status_idx").on(table.status),
  index("dockets_county_idx").on(table.county),
  index("dockets_filing_date_idx").on(table.filingDate),
]);

export const docketEvents = pgTable("docket_events", {
  id: serial("id").primaryKey(),
  docketId: integer("docket_id").notNull().references(() => dockets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("docket_events_docket_id_idx").on(table.docketId),
]);

export const researchDocuments = pgTable("research_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  content: text("content"),
  tags: text("tags").array(),
  sourceUrl: text("source_url"),
  laserficheUrl: text("laserfiche_url"),
  relatedDocketId: integer("related_docket_id").references(() => dockets.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("research_documents_category_idx").on(table.category),
]);

export const docketSubscriptions = pgTable("docket_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  docketId: integer("docket_id").notNull().references(() => dockets.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("docket_subscriptions_user_docket_idx").on(table.userId, table.docketId),
  index("docket_subscriptions_user_id_idx").on(table.userId),
]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  docketId: integer("docket_id").references(() => dockets.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_user_read_idx").on(table.userId, table.read),
]);

export const docketDocuments = pgTable("docket_documents", {
  id: serial("id").primaryKey(),
  docketId: integer("docket_id").notNull().references(() => dockets.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  documentType: text("document_type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("docket_documents_docket_id_idx").on(table.docketId),
]);

export const draftTemplates = pgTable("draft_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  templateContent: text("template_content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const savedDrafts = pgTable("saved_drafts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  templateId: integer("template_id").references(() => draftTemplates.id),
  docketId: integer("docket_id").references(() => dockets.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("saved_drafts_user_id_idx").on(table.userId),
]);

export const importJobs = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecords: integer("total_records").notNull().default(0),
  createdRecords: integer("created_records").notNull().default(0),
  updatedRecords: integer("updated_records").notNull().default(0),
  skippedRecords: integer("skipped_records").notNull().default(0),
  failedRecords: integer("failed_records").notNull().default(0),
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const importRecords = pgTable("import_records", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number"),
  caseNumber: text("case_number"),
  action: text("action"),
  errorMessage: text("error_message"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("import_records_job_id_idx").on(table.jobId),
]);

export const importJobsRelations = relations(importJobs, ({ many }) => ({
  records: many(importRecords),
}));

export const importRecordsRelations = relations(importRecords, ({ one }) => ({
  job: one(importJobs, { fields: [importRecords.jobId], references: [importJobs.id] }),
}));

export const docketsRelations = relations(dockets, ({ many }) => ({
  events: many(docketEvents),
  subscriptions: many(docketSubscriptions),
  documents: many(researchDocuments),
  uploadedDocuments: many(docketDocuments),
}));

export const docketEventsRelations = relations(docketEvents, ({ one }) => ({
  docket: one(dockets, { fields: [docketEvents.docketId], references: [dockets.id] }),
}));

export const researchDocumentsRelations = relations(researchDocuments, ({ one }) => ({
  docket: one(dockets, { fields: [researchDocuments.relatedDocketId], references: [dockets.id] }),
}));

export const docketSubscriptionsRelations = relations(docketSubscriptions, ({ one }) => ({
  docket: one(dockets, { fields: [docketSubscriptions.docketId], references: [dockets.id] }),
}));

export const docketDocumentsRelations = relations(docketDocuments, ({ one }) => ({
  docket: one(dockets, { fields: [docketDocuments.docketId], references: [dockets.id] }),
}));

export const insertDocketSchema = createInsertSchema(dockets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocketEventSchema = createInsertSchema(docketEvents).omit({
  id: true,
  createdAt: true,
});

export const insertResearchDocumentSchema = createInsertSchema(researchDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDocketSubscriptionSchema = createInsertSchema(docketSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDocketDocumentSchema = createInsertSchema(docketDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDraftTemplateSchema = createInsertSchema(draftTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertSavedDraftSchema = createInsertSchema(savedDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Docket = typeof dockets.$inferSelect;
export type InsertDocket = z.infer<typeof insertDocketSchema>;
export type DocketEvent = typeof docketEvents.$inferSelect;
export type InsertDocketEvent = z.infer<typeof insertDocketEventSchema>;
export type ResearchDocument = typeof researchDocuments.$inferSelect;
export type InsertResearchDocument = z.infer<typeof insertResearchDocumentSchema>;
export type DocketSubscription = typeof docketSubscriptions.$inferSelect;
export type InsertDocketSubscription = z.infer<typeof insertDocketSubscriptionSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type DocketDocument = typeof docketDocuments.$inferSelect;
export type InsertDocketDocument = z.infer<typeof insertDocketDocumentSchema>;
export type DraftTemplate = typeof draftTemplates.$inferSelect;
export type InsertDraftTemplate = z.infer<typeof insertDraftTemplateSchema>;
export type SavedDraft = typeof savedDrafts.$inferSelect;
export type InsertSavedDraft = z.infer<typeof insertSavedDraftSchema>;

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
});

export const insertImportRecordSchema = createInsertSchema(importRecords).omit({
  id: true,
  createdAt: true,
});

export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportRecord = typeof importRecords.$inferSelect;
export type InsertImportRecord = z.infer<typeof insertImportRecordSchema>;
