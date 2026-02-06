import {
  dockets, docketEvents, researchDocuments, docketSubscriptions,
  notifications, draftTemplates, savedDrafts,
  type Docket, type InsertDocket, type DocketEvent, type InsertDocketEvent,
  type ResearchDocument, type InsertResearchDocument,
  type DocketSubscription, type InsertDocketSubscription,
  type Notification, type InsertNotification,
  type DraftTemplate, type InsertDraftTemplate,
  type SavedDraft, type InsertSavedDraft,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or } from "drizzle-orm";

export interface IStorage {
  getDockets(): Promise<Docket[]>;
  getDocket(id: number): Promise<Docket | undefined>;
  createDocket(docket: InsertDocket): Promise<Docket>;
  updateDocket(id: number, data: Partial<InsertDocket>): Promise<Docket | undefined>;

  getDocketEvents(docketId: number): Promise<DocketEvent[]>;
  createDocketEvent(event: InsertDocketEvent): Promise<DocketEvent>;

  getResearchDocuments(): Promise<ResearchDocument[]>;
  getResearchDocument(id: number): Promise<ResearchDocument | undefined>;
  createResearchDocument(doc: InsertResearchDocument): Promise<ResearchDocument>;

  getSubscriptions(userId: string): Promise<DocketSubscription[]>;
  createSubscription(sub: InsertDocketSubscription): Promise<DocketSubscription>;
  deleteSubscription(id: number): Promise<void>;
  getSubscriptionsByDocket(docketId: number): Promise<DocketSubscription[]>;

  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notif: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  getTemplates(): Promise<DraftTemplate[]>;
  getTemplate(id: number): Promise<DraftTemplate | undefined>;
  createTemplate(template: InsertDraftTemplate): Promise<DraftTemplate>;

  getSavedDrafts(userId: string): Promise<SavedDraft[]>;
  createSavedDraft(draft: InsertSavedDraft): Promise<SavedDraft>;
}

export class DatabaseStorage implements IStorage {
  async getDockets(): Promise<Docket[]> {
    return db.select().from(dockets).orderBy(desc(dockets.createdAt));
  }

  async getDocket(id: number): Promise<Docket | undefined> {
    const [docket] = await db.select().from(dockets).where(eq(dockets.id, id));
    return docket;
  }

  async createDocket(docket: InsertDocket): Promise<Docket> {
    const [created] = await db.insert(dockets).values(docket).returning();
    return created;
  }

  async updateDocket(id: number, data: Partial<InsertDocket>): Promise<Docket | undefined> {
    const [updated] = await db.update(dockets).set(data).where(eq(dockets.id, id)).returning();
    return updated;
  }

  async getDocketEvents(docketId: number): Promise<DocketEvent[]> {
    return db.select().from(docketEvents)
      .where(eq(docketEvents.docketId, docketId))
      .orderBy(desc(docketEvents.eventDate));
  }

  async createDocketEvent(event: InsertDocketEvent): Promise<DocketEvent> {
    const [created] = await db.insert(docketEvents).values(event).returning();
    return created;
  }

  async getResearchDocuments(): Promise<ResearchDocument[]> {
    return db.select().from(researchDocuments).orderBy(desc(researchDocuments.createdAt));
  }

  async getResearchDocument(id: number): Promise<ResearchDocument | undefined> {
    const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id));
    return doc;
  }

  async createResearchDocument(doc: InsertResearchDocument): Promise<ResearchDocument> {
    const [created] = await db.insert(researchDocuments).values(doc).returning();
    return created;
  }

  async getSubscriptions(userId: string): Promise<DocketSubscription[]> {
    return db.select().from(docketSubscriptions)
      .where(eq(docketSubscriptions.userId, userId))
      .orderBy(desc(docketSubscriptions.createdAt));
  }

  async createSubscription(sub: InsertDocketSubscription): Promise<DocketSubscription> {
    const [created] = await db.insert(docketSubscriptions).values(sub).returning();
    return created;
  }

  async deleteSubscription(id: number): Promise<void> {
    await db.delete(docketSubscriptions).where(eq(docketSubscriptions.id, id));
  }

  async getSubscriptionsByDocket(docketId: number): Promise<DocketSubscription[]> {
    return db.select().from(docketSubscriptions)
      .where(eq(docketSubscriptions.docketId, docketId));
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notif: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notif).returning();
    return created;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  async getTemplates(): Promise<DraftTemplate[]> {
    return db.select().from(draftTemplates).orderBy(draftTemplates.name);
  }

  async getTemplate(id: number): Promise<DraftTemplate | undefined> {
    const [template] = await db.select().from(draftTemplates).where(eq(draftTemplates.id, id));
    return template;
  }

  async createTemplate(template: InsertDraftTemplate): Promise<DraftTemplate> {
    const [created] = await db.insert(draftTemplates).values(template).returning();
    return created;
  }

  async getSavedDrafts(userId: string): Promise<SavedDraft[]> {
    return db.select().from(savedDrafts)
      .where(eq(savedDrafts.userId, userId))
      .orderBy(desc(savedDrafts.createdAt));
  }

  async createSavedDraft(draft: InsertSavedDraft): Promise<SavedDraft> {
    const [created] = await db.insert(savedDrafts).values(draft).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
