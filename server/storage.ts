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
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and, ilike, or, sql, count, inArray } from "drizzle-orm";

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_PAGE_LIMIT = 50;

export interface DocketFilters {
  search?: string;
  status?: string;
  county?: string;
  facilityType?: string;
  page?: number;
  pageSize?: number;
}

export interface DocketListResult {
  dockets: Docket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IStorage {
  getDockets(filters?: DocketFilters): Promise<DocketListResult>;
  getDocket(id: number): Promise<Docket | undefined>;
  createDocket(docket: InsertDocket): Promise<Docket>;
  updateDocket(id: number, data: Partial<InsertDocket>): Promise<Docket | undefined>;
  deleteDocket(id: number): Promise<boolean>;

  getDocketEvents(docketId: number): Promise<DocketEvent[]>;
  createDocketEvent(event: InsertDocketEvent): Promise<DocketEvent>;

  getResearchDocuments(pagination?: PaginationParams): Promise<PaginatedResult<ResearchDocument>>;
  getResearchDocument(id: number): Promise<ResearchDocument | undefined>;
  createResearchDocument(doc: InsertResearchDocument): Promise<ResearchDocument>;

  getSubscriptions(userId: string): Promise<DocketSubscription[]>;
  createSubscription(sub: InsertDocketSubscription): Promise<DocketSubscription>;
  deleteSubscription(id: number, userId: string): Promise<boolean>;
  getSubscriptionsByDocket(docketId: number): Promise<DocketSubscription[]>;

  getNotifications(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Notification>>;
  createNotification(notif: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number, userId: string): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<void>;

  getTemplates(): Promise<DraftTemplate[]>;
  getTemplate(id: number): Promise<DraftTemplate | undefined>;
  createTemplate(template: InsertDraftTemplate): Promise<DraftTemplate>;

  getSavedDrafts(userId: string): Promise<SavedDraft[]>;
  createSavedDraft(draft: InsertSavedDraft): Promise<SavedDraft>;

  getSubscribersForDocket(docketId: number): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  async getDockets(filters?: DocketFilters): Promise<DocketListResult> {
    const page = Math.max(filters?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters?.pageSize ?? 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(dockets.caseNumber, pattern),
          ilike(dockets.title, pattern),
          ilike(dockets.applicant, pattern),
          ilike(dockets.facilityName, pattern),
          ilike(dockets.county, pattern),
        )!,
      );
    }

    if (filters?.status) {
      conditions.push(eq(dockets.status, filters.status as typeof dockets.status.enumValues[number]));
    }

    if (filters?.county) {
      conditions.push(ilike(dockets.county, filters.county));
    }

    if (filters?.facilityType) {
      conditions.push(ilike(dockets.facilityType, filters.facilityType));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(dockets)
        .where(where)
        .orderBy(desc(dockets.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(dockets)
        .where(where),
    ]);

    return {
      dockets: data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
    const [updated] = await db.update(dockets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dockets.id, id))
      .returning();
    return updated;
  }

  async deleteDocket(id: number): Promise<boolean> {
    const result = await db.delete(dockets)
      .where(eq(dockets.id, id))
      .returning();
    return result.length > 0;
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

  async getResearchDocuments(pagination?: PaginationParams): Promise<PaginatedResult<ResearchDocument>> {
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = pagination?.offset ?? 0;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(researchDocuments)
        .orderBy(desc(researchDocuments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(researchDocuments),
    ]);

    return { data, total, limit, offset };
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

  async deleteSubscription(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(docketSubscriptions)
      .where(and(eq(docketSubscriptions.id, id), eq(docketSubscriptions.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getSubscriptionsByDocket(docketId: number): Promise<DocketSubscription[]> {
    return db.select().from(docketSubscriptions)
      .where(eq(docketSubscriptions.docketId, docketId));
  }

  async getNotifications(userId: string, pagination?: PaginationParams): Promise<PaginatedResult<Notification>> {
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = pagination?.offset ?? 0;

    const [data, [{ total }]] = await Promise.all([
      db.select().from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(notifications)
        .where(eq(notifications.userId, userId)),
    ]);

    return { data, total, limit, offset };
  }

  async createNotification(notif: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notif).returning();
    return created;
  }

  async markNotificationRead(id: number, userId: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result.length > 0;
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

  async getSubscribersForDocket(docketId: number): Promise<User[]> {
    const subs = await db.select({ userId: docketSubscriptions.userId })
      .from(docketSubscriptions)
      .where(eq(docketSubscriptions.docketId, docketId));
    if (subs.length === 0) return [];
    return db.select().from(users)
      .where(inArray(users.id, subs.map((s) => s.userId)));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users)
      .where(eq(users.role, role as typeof users.role.enumValues[number]));
  }
}

export const storage = new DatabaseStorage();
