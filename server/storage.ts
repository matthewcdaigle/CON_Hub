import {
  eq,
  and,
  or,
  desc,
  asc,
  ilike,
  gt,
  gte,
  lte,
  sql,
  count,
} from "drizzle-orm";
import { db } from "./db";
import {
  proceedings,
  proceedingEvents,
  proceedingDocuments,
  clients,
  clientProceedings,
  proximityAlerts,
  subscriptions,
  notifications,
  deadlines,
  researchDocuments,
  caseBriefs,
  draftTemplates,
  savedDrafts,
  syncJobs,
  teams,
  type Proceeding,
  type InsertProceeding,
  type ProceedingEvent,
  type InsertProceedingEvent,
  type ProceedingDocument,
  type InsertProceedingDocument,
  type Client,
  type InsertClient,
  type ClientProceeding,
  type InsertClientProceeding,
  type ProximityAlert,
  type Subscription,
  type InsertSubscription,
  type Notification,
  type InsertNotification,
  type Deadline,
  type InsertDeadline,
  type ResearchDocument,
  type InsertResearchDocument,
  type CaseBrief,
  type InsertCaseBrief,
  type DraftTemplate,
  type SavedDraft,
  type InsertSavedDraft,
  type SyncJob,
  type InsertSyncJob,
  type Team,
  type InsertTeam,
} from "@shared/schema";
import { users, type UpsertUser, type User } from "@shared/models/auth";

// ===================== OPTION TYPES =====================

export interface ProceedingsOptions {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  county?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  facilityType?: string;
}

export interface NotificationsOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface DeadlinesOptions {
  proceedingId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  completed?: boolean;
}

export interface ResearchDocumentsOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

// ===================== DATABASE STORAGE CLASS =====================

export class DatabaseStorage {
  // =================== PROCEEDINGS ===================

  async getProceedings(
    options: ProceedingsOptions = {}
  ): Promise<{ data: Proceeding[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      county,
      search,
      dateFrom,
      dateTo,
      facilityType,
    } = options;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (type) {
      conditions.push(eq(proceedings.proceedingType, type as any));
    }
    if (status) {
      conditions.push(eq(proceedings.status, status as any));
    }
    if (county) {
      conditions.push(eq(proceedings.county, county));
    }
    if (facilityType) {
      conditions.push(eq(proceedings.facilityType, facilityType));
    }
    if (search) {
      conditions.push(
        or(
          ilike(proceedings.title, `%${search}%`),
          ilike(proceedings.applicant, `%${search}%`),
          ilike(proceedings.caseNumber, `%${search}%`),
          ilike(proceedings.facilityName, `%${search}%`)
        )!
      );
    }
    if (dateFrom) {
      conditions.push(gte(proceedings.filingDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(proceedings.filingDate, dateTo));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(proceedings)
        .where(where)
        .orderBy(desc(proceedings.filingDate))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(proceedings).where(where),
    ]);

    return { data, total: totalResult[0].count };
  }

  async getProceedingById(id: number): Promise<Proceeding | undefined> {
    const [result] = await db
      .select()
      .from(proceedings)
      .where(eq(proceedings.id, id));
    return result;
  }

  async getProceedingByCaseNumber(
    caseNumber: string
  ): Promise<Proceeding | undefined> {
    const [result] = await db
      .select()
      .from(proceedings)
      .where(eq(proceedings.caseNumber, caseNumber));
    return result;
  }

  async createProceeding(data: InsertProceeding): Promise<Proceeding> {
    const [result] = await db.insert(proceedings).values(data).returning();
    return result;
  }

  async updateProceeding(
    id: number,
    data: Partial<InsertProceeding>
  ): Promise<Proceeding | undefined> {
    const [result] = await db
      .update(proceedings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(proceedings.id, id))
      .returning();
    return result;
  }

  async deleteProceeding(id: number): Promise<boolean> {
    const result = await db
      .delete(proceedings)
      .where(eq(proceedings.id, id))
      .returning({ id: proceedings.id });
    return result.length > 0;
  }

  async getNearbyProceedings(
    lat: number,
    lng: number,
    radiusMiles: number,
    limit: number = 50
  ): Promise<(Proceeding & { distance: number })[]> {
    const result = await db.execute(sql`
      SELECT *,
        (
          3959 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          )
        ) AS distance
      FROM proceedings
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND (
          3959 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          )
        ) < ${radiusMiles}
      ORDER BY distance
      LIMIT ${limit}
    `);
    return result.rows as (Proceeding & { distance: number })[];
  }

  // =================== PROCEEDING EVENTS ===================

  async getProceedingEvents(
    proceedingId: number
  ): Promise<ProceedingEvent[]> {
    return db
      .select()
      .from(proceedingEvents)
      .where(eq(proceedingEvents.proceedingId, proceedingId))
      .orderBy(desc(proceedingEvents.eventDate));
  }

  async createProceedingEvent(
    data: InsertProceedingEvent
  ): Promise<ProceedingEvent> {
    const [result] = await db
      .insert(proceedingEvents)
      .values(data)
      .returning();
    return result;
  }

  // =================== PROCEEDING DOCUMENTS ===================

  async getProceedingDocuments(
    proceedingId: number
  ): Promise<ProceedingDocument[]> {
    return db
      .select()
      .from(proceedingDocuments)
      .where(eq(proceedingDocuments.proceedingId, proceedingId))
      .orderBy(desc(proceedingDocuments.createdAt));
  }

  async getDocumentById(id: number): Promise<ProceedingDocument | undefined> {
    const [result] = await db
      .select()
      .from(proceedingDocuments)
      .where(eq(proceedingDocuments.id, id));
    return result;
  }

  async createProceedingDocument(
    data: InsertProceedingDocument
  ): Promise<ProceedingDocument> {
    const [result] = await db
      .insert(proceedingDocuments)
      .values(data)
      .returning();
    return result;
  }

  async updateDocument(
    id: number,
    data: Partial<InsertProceedingDocument>
  ): Promise<ProceedingDocument | undefined> {
    const [result] = await db
      .update(proceedingDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(proceedingDocuments.id, id))
      .returning();
    return result;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db
      .delete(proceedingDocuments)
      .where(eq(proceedingDocuments.id, id))
      .returning({ id: proceedingDocuments.id });
    return result.length > 0;
  }

  // =================== CLIENTS ===================

  async getClients(teamId: number): Promise<Client[]> {
    return db
      .select()
      .from(clients)
      .where(eq(clients.teamId, teamId))
      .orderBy(asc(clients.name));
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const [result] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    return result;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [result] = await db.insert(clients).values(data).returning();
    return result;
  }

  async updateClient(
    id: number,
    data: Partial<InsertClient>
  ): Promise<Client | undefined> {
    const [result] = await db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return result;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ id: clients.id });
    return result.length > 0;
  }

  // =================== CLIENT PROCEEDINGS ===================

  async getClientProceedings(
    clientId: number
  ): Promise<ClientProceeding[]> {
    return db
      .select()
      .from(clientProceedings)
      .where(eq(clientProceedings.clientId, clientId))
      .orderBy(desc(clientProceedings.createdAt));
  }

  async createClientProceeding(
    data: InsertClientProceeding
  ): Promise<ClientProceeding> {
    const [result] = await db
      .insert(clientProceedings)
      .values(data)
      .returning();
    return result;
  }

  async deleteClientProceeding(id: number): Promise<boolean> {
    const result = await db
      .delete(clientProceedings)
      .where(eq(clientProceedings.id, id))
      .returning({ id: clientProceedings.id });
    return result.length > 0;
  }

  // =================== PROXIMITY ALERTS ===================

  async getProximityAlerts(clientId: number): Promise<ProximityAlert[]> {
    return db
      .select()
      .from(proximityAlerts)
      .where(eq(proximityAlerts.clientId, clientId))
      .orderBy(asc(proximityAlerts.distanceMiles));
  }

  async createProximityAlert(
    data: { clientId: number; proceedingId: number; distanceMiles: number }
  ): Promise<ProximityAlert> {
    const [result] = await db
      .insert(proximityAlerts)
      .values(data)
      .onConflictDoUpdate({
        target: [proximityAlerts.clientId, proximityAlerts.proceedingId],
        set: { distanceMiles: data.distanceMiles },
      })
      .returning();
    return result;
  }

  async clearProximityAlerts(clientId: number): Promise<void> {
    await db
      .delete(proximityAlerts)
      .where(eq(proximityAlerts.clientId, clientId));
  }

  // =================== SUBSCRIPTIONS ===================

  async getSubscriptions(userId: string): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [result] = await db
      .insert(subscriptions)
      .values(data)
      .returning();
    return result;
  }

  async deleteSubscription(id: number): Promise<boolean> {
    const result = await db
      .delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning({ id: subscriptions.id });
    return result.length > 0;
  }

  // =================== NOTIFICATIONS ===================

  async getNotifications(
    userId: string,
    options: NotificationsOptions = {}
  ): Promise<{ data: Notification[]; total: number }> {
    const { page = 1, limit = 20, unreadOnly } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.read, false));
    }

    const where = and(...conditions);

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(notifications).where(where),
    ]);

    return { data, total: totalResult[0].count };
  }

  async markNotificationRead(id: number): Promise<Notification | undefined> {
    const [result] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return result;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false))
      );
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [result] = await db
      .insert(notifications)
      .values(data)
      .returning();
    return result;
  }

  // =================== DEADLINES ===================

  async getDeadlines(options: DeadlinesOptions = {}): Promise<Deadline[]> {
    const { proceedingId, dateFrom, dateTo, completed } = options;

    const conditions = [];

    if (proceedingId !== undefined) {
      conditions.push(eq(deadlines.proceedingId, proceedingId));
    }
    if (dateFrom) {
      conditions.push(gte(deadlines.dueDate, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(deadlines.dueDate, dateTo));
    }
    if (completed !== undefined) {
      conditions.push(eq(deadlines.isCompleted, completed));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select()
      .from(deadlines)
      .where(where)
      .orderBy(asc(deadlines.dueDate));
  }

  async getDeadlinesByProceeding(
    proceedingId: number
  ): Promise<Deadline[]> {
    return db
      .select()
      .from(deadlines)
      .where(eq(deadlines.proceedingId, proceedingId))
      .orderBy(asc(deadlines.dueDate));
  }

  async createDeadline(data: InsertDeadline): Promise<Deadline> {
    const [result] = await db.insert(deadlines).values(data).returning();
    return result;
  }

  async updateDeadline(
    id: number,
    data: Partial<InsertDeadline>
  ): Promise<Deadline | undefined> {
    const [result] = await db
      .update(deadlines)
      .set(data)
      .where(eq(deadlines.id, id))
      .returning();
    return result;
  }

  async deleteDeadline(id: number): Promise<boolean> {
    const result = await db
      .delete(deadlines)
      .where(eq(deadlines.id, id))
      .returning({ id: deadlines.id });
    return result.length > 0;
  }

  // =================== RESEARCH DOCUMENTS ===================

  async getResearchDocuments(
    options: ResearchDocumentsOptions = {}
  ): Promise<{ data: ResearchDocument[]; total: number }> {
    const { page = 1, limit = 20, category, search } = options;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (category) {
      conditions.push(eq(researchDocuments.category, category));
    }
    if (search) {
      conditions.push(
        or(
          ilike(researchDocuments.title, `%${search}%`),
          ilike(researchDocuments.description, `%${search}%`)
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(researchDocuments)
        .where(where)
        .orderBy(desc(researchDocuments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(researchDocuments).where(where),
    ]);

    return { data, total: totalResult[0].count };
  }

  async getResearchDocumentById(
    id: number
  ): Promise<ResearchDocument | undefined> {
    const [result] = await db
      .select()
      .from(researchDocuments)
      .where(eq(researchDocuments.id, id));
    return result;
  }

  async createResearchDocument(
    data: InsertResearchDocument
  ): Promise<ResearchDocument> {
    const [result] = await db
      .insert(researchDocuments)
      .values(data)
      .returning();
    return result;
  }

  // =================== CASE BRIEFS ===================

  async getCaseBriefs(): Promise<CaseBrief[]> {
    return db
      .select()
      .from(caseBriefs)
      .orderBy(desc(caseBriefs.updatedAt));
  }

  async getCaseBriefByProceeding(
    proceedingId: number
  ): Promise<CaseBrief | undefined> {
    const [result] = await db
      .select()
      .from(caseBriefs)
      .where(eq(caseBriefs.proceedingId, proceedingId));
    return result;
  }

  async createCaseBrief(data: InsertCaseBrief): Promise<CaseBrief> {
    const [result] = await db.insert(caseBriefs).values(data).returning();
    return result;
  }

  async updateCaseBrief(
    id: number,
    data: Partial<InsertCaseBrief>
  ): Promise<CaseBrief | undefined> {
    const [result] = await db
      .update(caseBriefs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(caseBriefs.id, id))
      .returning();
    return result;
  }

  // =================== DRAFT TEMPLATES & SAVED DRAFTS ===================

  async getDraftTemplates(): Promise<DraftTemplate[]> {
    return db
      .select()
      .from(draftTemplates)
      .orderBy(asc(draftTemplates.category), asc(draftTemplates.name));
  }

  async getSavedDrafts(userId: string): Promise<SavedDraft[]> {
    return db
      .select()
      .from(savedDrafts)
      .where(eq(savedDrafts.userId, userId))
      .orderBy(desc(savedDrafts.updatedAt));
  }

  async createSavedDraft(data: InsertSavedDraft): Promise<SavedDraft> {
    const [result] = await db.insert(savedDrafts).values(data).returning();
    return result;
  }

  async updateSavedDraft(
    id: number,
    data: Partial<InsertSavedDraft>
  ): Promise<SavedDraft | undefined> {
    const [result] = await db
      .update(savedDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(savedDrafts.id, id))
      .returning();
    return result;
  }

  // =================== SYNC JOBS ===================

  async getSyncJobs(limit: number = 20): Promise<SyncJob[]> {
    return db
      .select()
      .from(syncJobs)
      .orderBy(desc(syncJobs.createdAt))
      .limit(limit);
  }

  async createSyncJob(data: InsertSyncJob): Promise<SyncJob> {
    const [result] = await db.insert(syncJobs).values(data).returning();
    return result;
  }

  async updateSyncJob(
    id: number,
    data: Partial<InsertSyncJob>
  ): Promise<SyncJob | undefined> {
    const [result] = await db
      .update(syncJobs)
      .set(data)
      .where(eq(syncJobs.id, id))
      .returning();
    return result;
  }

  // =================== TEAMS ===================

  async getTeamById(id: number): Promise<Team | undefined> {
    const [result] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id));
    return result;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [result] = await db.insert(teams).values(data).returning();
    return result;
  }

  // =================== USERS ===================

  async upsertUser(data: UpsertUser): Promise<User> {
    const [result] = await db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          profileImageUrl: data.profileImageUrl,
          role: data.role,
          teamId: data.teamId,
          oauthProvider: data.oauthProvider,
          oauthId: data.oauthId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }
  // =================== DASHBOARD ===================

  async getDashboardStats() {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proceedings);
    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proceedings)
      .where(
        and(
          sql`${proceedings.status} NOT IN ('closed', 'withdrawn')`,
          sql`${proceedings.outcome} IS NULL OR ${proceedings.outcome} NOT IN ('withdrawn')`
        )
      );
    const [deadlineResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(deadlines)
      .where(
        and(eq(deadlines.isCompleted, false), gt(deadlines.dueDate, new Date()))
      );
    const [notifResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.read, false));

    return {
      totalProceedings: Number(totalResult.count),
      activeProceedings: Number(activeResult.count),
      upcomingDeadlines: Number(deadlineResult.count),
      unreadNotifications: Number(notifResult.count),
    };
  }
}

export const storage = new DatabaseStorage();
