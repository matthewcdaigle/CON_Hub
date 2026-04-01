import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireAdmin } from "./auth";
import { z } from "zod";
import {
  insertProceedingSchema,
  insertProceedingEventSchema,
  insertSubscriptionSchema,
  insertDeadlineSchema,
  insertClientSchema,
  insertClientProceedingSchema,
  insertSavedDraftSchema,
} from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { geocodeAddress } from "./services/geocoding";
import { recalculateProximityAlerts } from "./jobs/proximity-calculator";

// Lazy OpenAI initialization
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI_INTEGRATIONS_OPENAI_API_KEY is not configured. Set this environment variable to enable AI features."
      );
    }
    _openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

function parseId(raw: string | string[]): number | null {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(str, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parsePagination(query: Record<string, any>): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

// File upload config
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${crypto.randomUUID()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Validation schemas
const proceedingListQuery = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  search: z.string().optional(),
  type: z.enum(["con", "det", "det_eqt", "det_asc"]).optional(),
  status: z.string().optional(),
  county: z.string().optional(),
  facilityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const generateDraftBody = z.object({
  prompt: z.string().min(1),
  proceedingId: z.number().int().positive().optional(),
  templateId: z.number().int().positive().optional(),
});

export async function registerRoutes(server: Server, app: Express) {
  // Setup authentication
  setupAuth(app);

  // ===================== PROCEEDINGS =====================

  app.get("/api/proceedings", isAuthenticated, async (req, res) => {
    try {
      const query = proceedingListQuery.parse(req.query);
      const { limit, offset } = parsePagination(query);
      const page = Math.floor(offset / limit) + 1;
      const result = await storage.getProceedings({
        page,
        limit,
        search: query.search,
        type: query.type as any,
        status: query.status,
        county: query.county,
        facilityType: query.facilityType,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/proceedings/nearby", isAuthenticated, async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 25;
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "lat and lng are required" });
      }
      const results = await storage.getNearbyProceedings(lat, lng, radius);
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/proceedings/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const proceeding = await storage.getProceedingById(id);
    if (!proceeding)
      return res.status(404).json({ message: "Proceeding not found" });
    return res.json(proceeding);
  });

  app.post("/api/proceedings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const data = insertProceedingSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id,
      });

      // Geocode address if provided
      if (data.address && !data.latitude) {
        const coords = await geocodeAddress(data.address + ", Georgia, USA");
        if (coords) {
          data.latitude = coords.latitude;
          data.longitude = coords.longitude;
        }
      }

      const proceeding = await storage.createProceeding(data);

      // Trigger proximity recalculation
      if (proceeding.latitude && proceeding.longitude) {
        recalculateProximityAlerts(proceeding.id).catch(console.error);
      }

      return res.status(201).json(proceeding);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/proceedings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const proceeding = await storage.updateProceeding(id, req.body);
      if (!proceeding)
        return res.status(404).json({ message: "Proceeding not found" });
      return res.json(proceeding);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/proceedings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteProceeding(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== PROCEEDING EVENTS =====================

  app.get("/api/proceedings/:id/events", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const events = await storage.getProceedingEvents(id);
    return res.json(events);
  });

  app.post("/api/proceedings/:id/events", isAuthenticated, requireAdmin, async (req, res) => {
    const proceedingId = parseId(req.params.id);
    if (!proceedingId)
      return res.status(400).json({ message: "Invalid ID" });
    try {
      const data = insertProceedingEventSchema.parse({
        ...req.body,
        proceedingId,
      });
      const event = await storage.createProceedingEvent(data);
      return res.status(201).json(event);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // ===================== PROCEEDING DOCUMENTS =====================

  app.get("/api/proceedings/:id/documents", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const docs = await storage.getProceedingDocuments(id);
    return res.json(docs);
  });

  app.post(
    "/api/proceedings/:id/documents",
    isAuthenticated,
    requireAdmin,
    upload.single("file"),
    async (req, res) => {
      const proceedingId = parseId(req.params.id);
      if (!proceedingId)
        return res.status(400).json({ message: "Invalid ID" });

      const file = req.file;
      if (!file)
        return res.status(400).json({ message: "No file uploaded" });

      try {
        const doc = await storage.createProceedingDocument({
          proceedingId,
          filename: file.originalname,
          documentType: (req.body.documentType as any) || "other",
          localStorageKey: file.filename,
          mimeType: file.mimetype,
          fileSize: file.size,
          syncStatus: "synced",
          description: req.body.description,
          uploadedBy: (req.user as any).id,
        });
        return res.status(201).json(doc);
      } catch (err: any) {
        return res.status(400).json({ message: err.message });
      }
    }
  );

  app.get("/api/documents/:id/download", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const doc = await storage.getDocumentById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.localStorageKey) {
      const filePath = path.join(uploadsDir, doc.localStorageKey);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, doc.filename);
      }
    }

    if (doc.laserficheUrl) {
      return res.redirect(doc.laserficheUrl);
    }

    return res.status(404).json({ message: "File not available" });
  });

  app.delete("/api/documents/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const doc = await storage.getDocumentById(id);
    if (doc?.localStorageKey) {
      const filePath = path.join(uploadsDir, doc.localStorageKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await storage.deleteDocument(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== CLIENTS =====================

  app.get("/api/clients", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    if (!user.teamId) return res.json([]);
    const clients = await storage.getClients(user.teamId);
    return res.json(clients);
  });

  app.get("/api/clients/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const client = await storage.getClientById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    return res.json(client);
  });

  app.get("/api/clients/:id/nearby-activity", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const client = await storage.getClientById(id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (!client.latitude || !client.longitude) {
      return res.json([]);
    }
    const nearby = await storage.getNearbyProceedings(
      client.latitude,
      client.longitude,
      client.monitoringRadiusMiles
    );
    return res.json(nearby);
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    if (!user.teamId)
      return res.status(400).json({ message: "You must belong to a team to create clients" });
    try {
      const data = insertClientSchema.parse({
        ...req.body,
        teamId: user.teamId,
      });

      // Geocode address
      if (data.address && !data.latitude) {
        const coords = await geocodeAddress(data.address);
        if (coords) {
          data.latitude = coords.latitude;
          data.longitude = coords.longitude;
        }
      }

      const client = await storage.createClient(data);
      return res.status(201).json(client);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const client = await storage.updateClient(id, req.body);
      if (!client)
        return res.status(404).json({ message: "Client not found" });
      return res.json(client);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteClient(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== CLIENT PROCEEDINGS =====================

  app.get("/api/clients/:id/proceedings", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const links = await storage.getClientProceedings(id);
    return res.json(links);
  });

  app.post("/api/clients/:id/proceedings", isAuthenticated, async (req, res) => {
    const clientId = parseId(req.params.id);
    if (!clientId) return res.status(400).json({ message: "Invalid ID" });
    try {
      const data = insertClientProceedingSchema.parse({
        ...req.body,
        clientId,
      });
      const link = await storage.createClientProceeding(data);
      return res.status(201).json(link);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/client-proceedings/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteClientProceeding(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== DEADLINES =====================

  app.get("/api/deadlines", isAuthenticated, async (req, res) => {
    try {
      const proceedingId = req.query.proceedingId
        ? parseInt(req.query.proceedingId as string, 10)
        : undefined;
      const completed = req.query.includeCompleted === "true" ? undefined : false;
      const deadlines = await storage.getDeadlines({
        proceedingId,
        completed,
      });
      return res.json(deadlines);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/deadlines", isAuthenticated, async (req, res) => {
    try {
      const data = insertDeadlineSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id,
      });
      const deadline = await storage.createDeadline(data);
      return res.status(201).json(deadline);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/deadlines/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const deadline = await storage.updateDeadline(id, req.body);
      if (!deadline)
        return res.status(404).json({ message: "Deadline not found" });
      return res.json(deadline);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/deadlines/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteDeadline(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== SUBSCRIPTIONS =====================

  app.get("/api/subscriptions", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const subs = await storage.getSubscriptions(userId);
    return res.json(subs);
  });

  app.post("/api/subscriptions", isAuthenticated, async (req, res) => {
    try {
      const data = insertSubscriptionSchema.parse({
        ...req.body,
        userId: (req.user as any).id,
      });
      const sub = await storage.createSubscription(data);
      return res.status(201).json(sub);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/subscriptions/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteSubscription(id);
    return res.json({ message: "Deleted" });
  });

  // ===================== NOTIFICATIONS =====================

  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const { limit, offset } = parsePagination(req.query as any);
    const unreadOnly = req.query.unreadOnly === "true";
    const page = Math.floor(offset / limit) + 1;
    const result = await storage.getNotifications(userId, {
      page,
      limit,
      unreadOnly,
    });
    return res.json(result);
  });

  app.patch("/api/notifications/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    await storage.markNotificationRead(id);
    return res.json({ message: "Marked as read" });
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    await storage.markAllNotificationsRead(userId);
    return res.json({ message: "All marked as read" });
  });

  // ===================== RESEARCH =====================

  app.get("/api/research", isAuthenticated, async (req, res) => {
    const { limit, offset } = parsePagination(req.query as any);
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.floor(offset / limit) + 1;
    const result = await storage.getResearchDocuments({
      page,
      limit,
      category,
      search,
    });
    return res.json(result);
  });

  app.get("/api/research/:id", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const doc = await storage.getResearchDocumentById(id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    return res.json(doc);
  });

  // ===================== CASE BRIEFS =====================

  app.get("/api/case-briefs", isAuthenticated, async (_req, res) => {
    const briefs = await storage.getCaseBriefs();
    return res.json(briefs);
  });

  app.get("/api/case-briefs/proceeding/:proceedingId", isAuthenticated, async (req, res) => {
    const proceedingId = parseId(req.params.proceedingId);
    if (!proceedingId)
      return res.status(400).json({ message: "Invalid ID" });
    const brief = await storage.getCaseBriefByProceeding(proceedingId);
    if (!brief) return res.status(404).json({ message: "No brief found" });
    return res.json(brief);
  });

  app.post("/api/case-briefs", isAuthenticated, async (req, res) => {
    try {
      const brief = await storage.createCaseBrief(req.body);
      return res.status(201).json(brief);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/case-briefs/generate", isAuthenticated, async (req, res) => {
    const { proceedingId, context } = req.body;
    if (!proceedingId)
      return res.status(400).json({ message: "proceedingId is required" });

    const proceeding = await storage.getProceedingById(proceedingId);
    if (!proceeding)
      return res.status(404).json({ message: "Proceeding not found" });

    try {
      const openai = getOpenAI();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are a legal analyst specializing in Georgia Certificate of Need proceedings. Generate a structured case brief with these sections: Summary, Decision Issues, Appellate Issues, Judicial Review Considerations. Be thorough and cite relevant Georgia CON statutes and rules.`,
          },
          {
            role: "user",
            content: `Generate a case brief for: ${proceeding.title}\nCase Number: ${proceeding.caseNumber}\nApplicant: ${proceeding.applicant}\nFacility: ${proceeding.facilityName} (${proceeding.facilityType})\nCounty: ${proceeding.county}\nStatus: ${proceeding.status}\n${context ? `Additional context: ${context}` : ""}`,
          },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        return res.status(500).json({ message: err.message });
      }
      res.end();
    }
  });

  // ===================== DRAFTING =====================

  app.get("/api/templates", isAuthenticated, async (_req, res) => {
    const templates = await storage.getDraftTemplates();
    return res.json(templates);
  });

  app.get("/api/drafts", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).id;
    const drafts = await storage.getSavedDrafts(userId);
    return res.json(drafts);
  });

  app.post("/api/drafts", isAuthenticated, async (req, res) => {
    try {
      const data = insertSavedDraftSchema.parse({
        ...req.body,
        userId: (req.user as any).id,
      });
      const draft = await storage.createSavedDraft(data);
      return res.status(201).json(draft);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/drafts/generate", isAuthenticated, async (req, res) => {
    try {
      const { prompt, proceedingId } = generateDraftBody.parse(req.body);
      let proceedingContext = "";
      if (proceedingId) {
        const p = await storage.getProceedingById(proceedingId);
        if (p) {
          proceedingContext = `\nContext - Proceeding: ${p.title} (${p.caseNumber}), Applicant: ${p.applicant}, Facility: ${p.facilityName}, County: ${p.county}, Status: ${p.status}`;
        }
      }

      const openai = getOpenAI();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are a legal document drafter specializing in Georgia Certificate of Need proceedings. Draft professional legal documents following Georgia CON rules and regulations (O.C.G.A. Chapter 31-6, Rules 111-2-2).`,
          },
          {
            role: "user",
            content: `${prompt}${proceedingContext}`,
          },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        return res.status(500).json({ message: err.message });
      }
      res.end();
    }
  });

  // ===================== AI DOCUMENT ANALYSIS =====================

  app.post("/api/documents/:id/summarize", isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const doc = await storage.getDocumentById(id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.aiSummary) {
      return res.json({ summary: doc.aiSummary });
    }

    try {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a legal analyst. Provide a concise summary of this document related to Georgia Certificate of Need proceedings.",
          },
          {
            role: "user",
            content: `Summarize this document: ${doc.filename}\nType: ${doc.documentType}\n${doc.description || ""}`,
          },
        ],
      });

      const summary = response.choices[0]?.message?.content || "";
      await storage.updateDocument(id, { aiSummary: summary });
      return res.json({ summary });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // ===================== ADMIN =====================

  app.post(
    "/api/admin/import-tracking-report",
    isAuthenticated,
    requireAdmin,
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      try {
        const { parseTrackingReport, applyTrackingReportToDatabase } = await import(
          "./services/tracking-report-parser"
        );
        const pdfBuffer = fs.readFileSync(file.path);
        const parsed = await parseTrackingReport(pdfBuffer);
        const result = await applyTrackingReportToDatabase(parsed);
        return res.json({
          message: "Import complete",
          reportDate: parsed.reportDate,
          entriesFound: parsed.entries.length,
          ...result,
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }
  );

  app.get("/api/admin/sync-jobs", isAuthenticated, requireAdmin, async (_req, res) => {
    const jobs = await storage.getSyncJobs(50);
    return res.json(jobs);
  });

  // ===================== TEAMS =====================

  app.post("/api/teams", isAuthenticated, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Team name required" });
      const team = await storage.createTeam({ name });
      return res.status(201).json(team);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // ===================== DASHBOARD STATS =====================

  app.get("/api/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });
}
