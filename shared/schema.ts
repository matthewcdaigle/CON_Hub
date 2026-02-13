import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const docketStatusEnum = pgEnum("docket_status", [
  "pre_filing",
  "filed",
  "under_review",
  "hearing_scheduled",
  "hearing_complete",
  "decision_pending",
  "approved",
  "denied",
  "withdrawn",
  "appealed",
]);

export const dockets = pgTable("dockets", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  applicant: text("applicant").notNull(),
  facilityName: text("facility_name").notNull(),
  facilityType: text("facility_type").notNull(),
  county: text("county").notNull(),
  status: docketStatusEnum("status").notNull().default("filed"),
  filingDate: timestamp("filing_date").notNull(),
  hearingDate: timestamp("hearing_date"),
  decisionDate: timestamp("decision_date"),
  description: text("description"),
  estimatedCost: text("estimated_cost"),
  laserficheUrl: text("laserfiche_url"),
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

export const docketsRelations = relations(dockets, ({ many }) => ({
  events: many(docketEvents),
  subscriptions: many(docketSubscriptions),
  documents: many(researchDocuments),
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
export type DraftTemplate = typeof draftTemplates.$inferSelect;
export type InsertDraftTemplate = z.infer<typeof insertDraftTemplateSchema>;
export type SavedDraft = typeof savedDrafts.$inferSelect;
export type InsertSavedDraft = z.infer<typeof insertSavedDraftSchema>;
