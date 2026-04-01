import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  serial,
  integer,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  doublePrecision,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export shared models
export * from "./models/auth";
export * from "./models/chat";
import { users } from "./models/auth";

// ===================== ENUMS =====================

export const proceedingTypeEnum = pgEnum("proceeding_type", [
  "con",
  "det",
  "det_eqt",
  "det_asc",
]);

export const proceedingStatusEnum = pgEnum("proceeding_status", [
  // CON lifecycle
  "loi_filed",
  "loi_expired",
  "loi_batching",
  "application_filed",
  "under_review",
  "incomplete",
  "pending_decision",
  "approved",
  "denied",
  "withdrawn",
  // DET/DET-EQT/DET-ASC lifecycle
  "request_filed",
  "determination_issued",
  // Shared appeal stages
  "appeal_filed",
  "appeal_hearing_pending",
  "appeal_decided",
  // Terminal
  "closed",
]);

export const outcomeEnum = pgEnum("proceeding_outcome", [
  "approved",
  "denied",
  "withdrawn",
  "dismissed",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "unsynced",
  "metadata_only",
  "full_sync",
]);

export const docSyncStatusEnum = pgEnum("doc_sync_status", [
  "metadata_only",
  "downloading",
  "synced",
  "error",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "application",
  "loi",
  "opposition",
  "determination",
  "correspondence",
  "exhibit",
  "brief",
  "order",
  "tracking_report",
  "other",
]);

export const subscriptionTypeEnum = pgEnum("subscription_type", [
  "proceeding",
  "county",
  "facility_type",
  "applicant",
  "client_radius",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "status_change",
  "new_document",
  "deadline_approaching",
  "new_filing_nearby",
  "custom",
]);

export const deadlineTypeEnum = pgEnum("deadline_type", [
  "loi_expiration",
  "application_due",
  "opposition_window",
  "hearing",
  "appeal_period",
  "custom",
]);

export const syncJobTypeEnum = pgEnum("sync_job_type", [
  "tracking_report_parse",
  "laserfiche_folder_scan",
  "document_download",
  "proximity_recalculate",
]);

export const syncJobStatusEnum = pgEnum("sync_job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const clientRelationshipEnum = pgEnum("client_relationship", [
  "applicant",
  "opponent",
  "interested_party",
]);

export const draftGeneratedByEnum = pgEnum("draft_generated_by", [
  "manual",
  "ai",
]);

// ===================== CORE TABLES =====================

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const proceedings = pgTable(
  "proceedings",
  {
    id: serial("id").primaryKey(),
    caseNumber: varchar("case_number", { length: 64 }).notNull().unique(),
    proceedingType: proceedingTypeEnum("proceeding_type").notNull(),
    status: proceedingStatusEnum("status").notNull().default("loi_filed"),
    title: text("title").notNull(),
    applicant: text("applicant").notNull(),
    applicantEntity: text("applicant_entity"),
    facilityName: text("facility_name").notNull(),
    facilityType: text("facility_type").notNull(),
    serviceType: text("service_type"),
    county: text("county").notNull(),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    filingDate: timestamp("filing_date").notNull(),
    loiDate: timestamp("loi_date"),
    applicationDate: timestamp("application_date"),
    hearingDate: timestamp("hearing_date"),
    decisionDate: timestamp("decision_date"),
    appealDeadline: timestamp("appeal_deadline"),
    outcome: outcomeEnum("outcome"),
    estimatedCost: text("estimated_cost"),
    bedCount: integer("bed_count"),
    equipmentType: text("equipment_type"),
    operatingRooms: integer("operating_rooms"),
    laserficheEntryId: text("laserfiche_entry_id"),
    laserficheUrl: text("laserfiche_url"),
    description: text("description"),
    notes: text("notes"),
    syncStatus: syncStatusEnum("sync_status").notNull().default("unsynced"),
    lastSyncedAt: timestamp("last_synced_at"),
    parentProceedingId: integer("parent_proceeding_id").references(
      (): any => proceedings.id,
      { onDelete: "set null" }
    ),
    createdBy: varchar("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("proceedings_type_idx").on(table.proceedingType),
    index("proceedings_status_idx").on(table.status),
    index("proceedings_county_idx").on(table.county),
    index("proceedings_filing_date_idx").on(table.filingDate),
    index("proceedings_lat_lng_idx").on(table.latitude, table.longitude),
  ]
);

export const proceedingEvents = pgTable(
  "proceeding_events",
  {
    id: serial("id").primaryKey(),
    proceedingId: integer("proceeding_id")
      .notNull()
      .references(() => proceedings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: timestamp("event_date").notNull(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull().default("manual"), // manual | tracking_report | laserfiche
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index("proceeding_events_proceeding_id_idx").on(table.proceedingId)]
);

export const proceedingDocuments = pgTable(
  "proceeding_documents",
  {
    id: serial("id").primaryKey(),
    proceedingId: integer("proceeding_id")
      .notNull()
      .references(() => proceedings.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    documentType: documentTypeEnum("document_type").notNull().default("other"),
    laserficheEntryId: text("laserfiche_entry_id"),
    laserficheUrl: text("laserfiche_url"),
    localStorageKey: text("local_storage_key"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    syncStatus: docSyncStatusEnum("doc_sync_status")
      .notNull()
      .default("metadata_only"),
    aiSummary: text("ai_summary"),
    description: text("description"),
    uploadedBy: varchar("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("proceeding_documents_proceeding_id_idx").on(table.proceedingId),
    index("proceeding_documents_sync_status_idx").on(table.syncStatus),
  ]
);

// ===================== CLIENT & COMPETITIVE INTELLIGENCE =====================

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    facilityType: text("facility_type"),
    address: text("address"),
    county: text("county"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    monitoringRadiusMiles: integer("monitoring_radius_miles")
      .notNull()
      .default(25),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("clients_team_id_idx").on(table.teamId),
    index("clients_lat_lng_idx").on(table.latitude, table.longitude),
  ]
);

export const clientProceedings = pgTable(
  "client_proceedings",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    proceedingId: integer("proceeding_id")
      .notNull()
      .references(() => proceedings.id, { onDelete: "cascade" }),
    relationship: clientRelationshipEnum("relationship").notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex("client_proceedings_unique_idx").on(
      table.clientId,
      table.proceedingId
    ),
  ]
);

export const proximityAlerts = pgTable(
  "proximity_alerts",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    proceedingId: integer("proceeding_id")
      .notNull()
      .references(() => proceedings.id, { onDelete: "cascade" }),
    distanceMiles: doublePrecision("distance_miles").notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("proximity_alerts_client_id_idx").on(table.clientId),
    uniqueIndex("proximity_alerts_unique_idx").on(
      table.clientId,
      table.proceedingId
    ),
  ]
);

// ===================== MONITORING & ALERTS =====================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionType: subscriptionTypeEnum("subscription_type").notNull(),
    proceedingId: integer("proceeding_id").references(() => proceedings.id, {
      onDelete: "cascade",
    }),
    filterCriteria: jsonb("filter_criteria"), // For complex filters: { county, facilityType, applicant, etc. }
    emailAlerts: boolean("email_alerts").notNull().default(true),
    inAppAlerts: boolean("in_app_alerts").notNull().default(true),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("subscriptions_user_id_idx").on(table.userId),
    index("subscriptions_type_idx").on(table.subscriptionType),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proceedingId: integer("proceeding_id").references(() => proceedings.id, {
      onDelete: "set null",
    }),
    subscriptionId: integer("subscription_id").references(
      () => subscriptions.id,
      { onDelete: "set null" }
    ),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").default(false).notNull(),
    emailSent: boolean("email_sent").default(false).notNull(),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.read),
  ]
);

export const deadlines = pgTable(
  "deadlines",
  {
    id: serial("id").primaryKey(),
    proceedingId: integer("proceeding_id")
      .notNull()
      .references(() => proceedings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: timestamp("due_date").notNull(),
    deadlineType: deadlineTypeEnum("deadline_type").notNull(),
    isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
    isCompleted: boolean("is_completed").notNull().default(false),
    reminderDaysBefore: integer("reminder_days_before").array(),
    createdBy: varchar("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index("deadlines_proceeding_id_idx").on(table.proceedingId),
    index("deadlines_due_date_idx").on(table.dueDate),
    index("deadlines_completed_idx").on(table.isCompleted),
  ]
);

// ===================== RESEARCH & DRAFTING =====================

export const researchDocuments = pgTable(
  "research_documents",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    content: text("content"),
    tags: text("tags").array(),
    sourceUrl: text("source_url"),
    laserficheUrl: text("laserfiche_url"),
    relatedProceedingId: integer("related_proceeding_id").references(
      () => proceedings.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index("research_documents_category_idx").on(table.category)]
);

export const caseBriefs = pgTable("case_briefs", {
  id: serial("id").primaryKey(),
  proceedingId: integer("proceeding_id")
    .notNull()
    .references(() => proceedings.id, { onDelete: "cascade" })
    .unique(),
  summary: text("summary").notNull(),
  decisionIssues: text("decision_issues").notNull(),
  appellateIssues: text("appellate_issues").notNull(),
  judicialReview: text("judicial_review").notNull(),
  generatedBy: draftGeneratedByEnum("generated_by")
    .notNull()
    .default("manual"),
  aiModel: text("ai_model"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const draftTemplates = pgTable("draft_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  templateContent: text("template_content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const savedDrafts = pgTable(
  "saved_drafts",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    templateId: integer("template_id").references(() => draftTemplates.id, {
      onDelete: "set null",
    }),
    proceedingId: integer("proceeding_id").references(() => proceedings.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index("saved_drafts_user_id_idx").on(table.userId)]
);

// ===================== DATA INGESTION =====================

export const syncJobs = pgTable("sync_jobs", {
  id: serial("id").primaryKey(),
  jobType: syncJobTypeEnum("job_type").notNull(),
  status: syncJobStatusEnum("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const trackingReportImports = pgTable("tracking_report_imports", {
  id: serial("id").primaryKey(),
  reportDate: timestamp("report_date").notNull(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key"),
  recordsCreated: integer("records_created").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  importedAt: timestamp("imported_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ===================== RELATIONS =====================

export const teamsRelations = relations(teams, ({ many }) => ({
  clients: many(clients),
}));

export const proceedingsRelations = relations(proceedings, ({ many, one }) => ({
  events: many(proceedingEvents),
  documents: many(proceedingDocuments),
  deadlines: many(deadlines),
  subscriptions: many(subscriptions),
  caseBrief: one(caseBriefs, {
    fields: [proceedings.id],
    references: [caseBriefs.proceedingId],
  }),
  clientProceedings: many(clientProceedings),
  proximityAlerts: many(proximityAlerts),
  researchDocuments: many(researchDocuments),
  savedDrafts: many(savedDrafts),
}));

export const proceedingEventsRelations = relations(
  proceedingEvents,
  ({ one }) => ({
    proceeding: one(proceedings, {
      fields: [proceedingEvents.proceedingId],
      references: [proceedings.id],
    }),
  })
);

export const proceedingDocumentsRelations = relations(
  proceedingDocuments,
  ({ one }) => ({
    proceeding: one(proceedings, {
      fields: [proceedingDocuments.proceedingId],
      references: [proceedings.id],
    }),
  })
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  team: one(teams, { fields: [clients.teamId], references: [teams.id] }),
  clientProceedings: many(clientProceedings),
  proximityAlerts: many(proximityAlerts),
}));

export const clientProceedingsRelations = relations(
  clientProceedings,
  ({ one }) => ({
    client: one(clients, {
      fields: [clientProceedings.clientId],
      references: [clients.id],
    }),
    proceeding: one(proceedings, {
      fields: [clientProceedings.proceedingId],
      references: [proceedings.id],
    }),
  })
);

export const proximityAlertsRelations = relations(
  proximityAlerts,
  ({ one }) => ({
    client: one(clients, {
      fields: [proximityAlerts.clientId],
      references: [clients.id],
    }),
    proceeding: one(proceedings, {
      fields: [proximityAlerts.proceedingId],
      references: [proceedings.id],
    }),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  proceeding: one(proceedings, {
    fields: [subscriptions.proceedingId],
    references: [proceedings.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  proceeding: one(proceedings, {
    fields: [notifications.proceedingId],
    references: [proceedings.id],
  }),
  subscription: one(subscriptions, {
    fields: [notifications.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const deadlinesRelations = relations(deadlines, ({ one }) => ({
  proceeding: one(proceedings, {
    fields: [deadlines.proceedingId],
    references: [proceedings.id],
  }),
}));

export const caseBriefsRelations = relations(caseBriefs, ({ one }) => ({
  proceeding: one(proceedings, {
    fields: [caseBriefs.proceedingId],
    references: [proceedings.id],
  }),
}));

export const researchDocumentsRelations = relations(
  researchDocuments,
  ({ one }) => ({
    proceeding: one(proceedings, {
      fields: [researchDocuments.relatedProceedingId],
      references: [proceedings.id],
    }),
  })
);

export const savedDraftsRelations = relations(savedDrafts, ({ one }) => ({
  user: one(users, { fields: [savedDrafts.userId], references: [users.id] }),
  template: one(draftTemplates, {
    fields: [savedDrafts.templateId],
    references: [draftTemplates.id],
  }),
  proceeding: one(proceedings, {
    fields: [savedDrafts.proceedingId],
    references: [proceedings.id],
  }),
}));

// ===================== INSERT SCHEMAS =====================

export const insertProceedingSchema = createInsertSchema(proceedings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProceedingEventSchema = createInsertSchema(
  proceedingEvents
).omit({
  id: true,
  createdAt: true,
});

export const insertProceedingDocumentSchema = createInsertSchema(
  proceedingDocuments
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientProceedingSchema = createInsertSchema(
  clientProceedings
).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDeadlineSchema = createInsertSchema(deadlines).omit({
  id: true,
  createdAt: true,
});

export const insertResearchDocumentSchema = createInsertSchema(
  researchDocuments
).omit({
  id: true,
  createdAt: true,
});

export const insertCaseBriefSchema = createInsertSchema(caseBriefs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDraftTemplateSchema = createInsertSchema(
  draftTemplates
).omit({
  id: true,
  createdAt: true,
});

export const insertSavedDraftSchema = createInsertSchema(savedDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});

export const insertSyncJobSchema = createInsertSchema(syncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertTrackingReportImportSchema = createInsertSchema(
  trackingReportImports
).omit({
  id: true,
  importedAt: true,
});

// ===================== TYPES =====================

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type Proceeding = typeof proceedings.$inferSelect;
export type InsertProceeding = z.infer<typeof insertProceedingSchema>;

export type ProceedingEvent = typeof proceedingEvents.$inferSelect;
export type InsertProceedingEvent = z.infer<typeof insertProceedingEventSchema>;

export type ProceedingDocument = typeof proceedingDocuments.$inferSelect;
export type InsertProceedingDocument = z.infer<
  typeof insertProceedingDocumentSchema
>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type ClientProceeding = typeof clientProceedings.$inferSelect;
export type InsertClientProceeding = z.infer<
  typeof insertClientProceedingSchema
>;

export type ProximityAlert = typeof proximityAlerts.$inferSelect;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;

export type ResearchDocument = typeof researchDocuments.$inferSelect;
export type InsertResearchDocument = z.infer<
  typeof insertResearchDocumentSchema
>;

export type CaseBrief = typeof caseBriefs.$inferSelect;
export type InsertCaseBrief = z.infer<typeof insertCaseBriefSchema>;

export type DraftTemplate = typeof draftTemplates.$inferSelect;
export type InsertDraftTemplate = z.infer<typeof insertDraftTemplateSchema>;

export type SavedDraft = typeof savedDrafts.$inferSelect;
export type InsertSavedDraft = z.infer<typeof insertSavedDraftSchema>;

export type SyncJob = typeof syncJobs.$inferSelect;
export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;

export type TrackingReportImport = typeof trackingReportImports.$inferSelect;
export type InsertTrackingReportImport = z.infer<
  typeof insertTrackingReportImportSchema
>;
