import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, requireAdmin } from "./replit_integrations/auth";
import { z } from "zod";
import {
  insertDocketSubscriptionSchema,
  insertSavedDraftSchema,
  insertDocketEventSchema,
} from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Lazy OpenAI initialization — fails at call time with a clear message
// rather than silently creating a broken client at import time
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is not configured. Set this environment variable to enable AI drafting.");
    }
    _openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

/** Parse and validate a numeric ID from route params. Returns null if invalid. */
function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Parse pagination query params with sensible bounds. */
function parsePagination(query: Record<string, any>): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
}

// Validation schemas for request bodies
const createSubscriptionBody = z.object({
  docketId: z.number().int().positive(),
});

const createDraftBody = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  templateId: z.number().int().positive().nullable().optional(),
  docketId: z.number().int().positive().nullable().optional(),
});

const generateDraftBody = z.object({
  prompt: z.string().min(1).max(10000),
  templateId: z.number().int().positive().nullable().optional(),
  docketId: z.number().int().positive().nullable().optional(),
  existingContent: z.string().max(50000).nullable().optional(),
});

const docketStatuses = [
  "pre_filing", "filed", "under_review", "hearing_scheduled",
  "hearing_complete", "decision_pending", "approved", "denied",
  "withdrawn", "appealed",
] as const;

const docketListQuery = z.object({
  search: z.string().optional(),
  status: z.enum(docketStatuses).optional(),
  county: z.string().optional(),
  facilityType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const createDocketBody = z.object({
  caseNumber: z.string().min(1).max(64),
  title: z.string().min(1),
  applicant: z.string().min(1),
  facilityName: z.string().min(1),
  facilityType: z.string().min(1),
  county: z.string().min(1),
  status: z.enum(docketStatuses).default("filed"),
  filingDate: z.coerce.date(),
  hearingDate: z.coerce.date().nullable().optional(),
  decisionDate: z.coerce.date().nullable().optional(),
  description: z.string().nullable().optional(),
  estimatedCost: z.string().nullable().optional(),
  laserficheUrl: z.string().url().nullable().optional(),
});

const updateDocketBody = createDocketBody.partial();

const createDocketEventBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  eventDate: z.coerce.date(),
  eventType: z.string().min(1),
});

/** Format a docket_status enum value for display in notifications. */
function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ── File upload config ────────────────────────────────────

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename(_req, file, cb) {
      const unique = crypto.randomUUID();
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${unique}-${safeOriginal}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Accepted: PDF, Word (.docx), Excel (.xlsx), and plain text."));
    }
  },
});

const documentTypes = ["application", "order", "notice", "correspondence", "other"] as const;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Demo login — development only
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/demo-login", async (req: any, res) => {
      try {
        const { authStorage } = await import("./replit_integrations/auth");
        const demoUser = await authStorage.upsertUser({
          id: "demo-user",
          email: "demo@gaconcounsel.com",
          firstName: "Demo",
          lastName: "Attorney",
          profileImageUrl: null,
        });

        const demoExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        req.login(
          {
            claims: {
              sub: demoUser.id,
              email: demoUser.email,
              first_name: demoUser.firstName,
              last_name: demoUser.lastName,
            },
            expires_at: demoExpiry,
          },
          (err: any) => {
            if (err) {
              console.error("Demo login error:", err);
              return res.status(500).json({ message: "Failed to log in" });
            }
            res.json({ success: true });
          }
        );
      } catch (error) {
        console.error("Demo login error:", error);
        res.status(500).json({ message: "Failed to log in" });
      }
    });
  }

  // ── Dockets ──────────────────────────────────────────────

  app.get("/api/dockets", async (req, res) => {
    try {
      const parsed = docketListQuery.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters", errors: parsed.error.flatten().fieldErrors });
      }
      const result = await storage.getDockets(parsed.data);
      res.json(result);
    } catch (error) {
      console.error("Error fetching dockets:", error);
      res.status(500).json({ message: "Failed to fetch dockets" });
    }
  });

  app.get("/api/dockets/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid docket ID" });
      const docket = await storage.getDocket(id);
      if (!docket) return res.status(404).json({ message: "Docket not found" });
      res.json(docket);
    } catch (error) {
      console.error("Error fetching docket:", error);
      res.status(500).json({ message: "Failed to fetch docket" });
    }
  });

  app.get("/api/dockets/:id/events", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid docket ID" });
      const events = await storage.getDocketEvents(id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/dockets/:id/events", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const docketId = parseId(req.params.id);
      if (!docketId) return res.status(400).json({ message: "Invalid docket ID" });
      const parsed = createDocketEventBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }

      const docket = await storage.getDocket(docketId);
      if (!docket) return res.status(404).json({ message: "Docket not found" });

      const event = await storage.createDocketEvent({ docketId, ...parsed.data });
      res.status(201).json(event);

      // Fire-and-forget: notify all subscribers about the new timeline event
      storage.getSubscribersForDocket(docketId).then((subscribers) =>
        Promise.all(subscribers.map((subscriber) =>
          storage.createNotification({
            userId: subscriber.id,
            docketId,
            title: "New Timeline Event",
            message: `New event on docket ${docket.caseNumber}: ${event.title}`,
          }),
        )),
      ).catch((err) => console.error("Error creating timeline-event notifications:", err));
    } catch (error) {
      console.error("Error creating docket event:", error);
      res.status(500).json({ message: "Failed to create docket event" });
    }
  });

  app.post("/api/dockets", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const parsed = createDocketBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }
      const docket = await storage.createDocket(parsed.data);
      res.status(201).json(docket);

      // Fire-and-forget: notify all admins about the new docket
      storage.getUsersByRole("admin").then((admins) =>
        Promise.all(admins.map((admin) =>
          storage.createNotification({
            userId: admin.id,
            docketId: docket.id,
            title: "New Docket Filed",
            message: `Docket ${docket.caseNumber} has been created for ${docket.facilityName}.`,
          }),
        )),
      ).catch((err) => console.error("Error creating new-docket notifications:", err));
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A docket with this case number already exists" });
      }
      console.error("Error creating docket:", error);
      res.status(500).json({ message: "Failed to create docket" });
    }
  });

  app.patch("/api/dockets/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid docket ID" });
      const parsed = updateDocketBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }

      // Fetch old docket to detect status change
      const oldDocket = parsed.data.status ? await storage.getDocket(id) : null;

      const updated = await storage.updateDocket(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Docket not found" });
      res.json(updated);

      // Fire-and-forget: if status changed, notify all subscribers
      if (oldDocket && parsed.data.status && oldDocket.status !== parsed.data.status) {
        storage.getSubscribersForDocket(id).then((subscribers) =>
          Promise.all(subscribers.map((subscriber) =>
            storage.createNotification({
              userId: subscriber.id,
              docketId: id,
              title: "Docket Status Updated",
              message: `Docket ${updated.caseNumber} status changed to ${formatStatus(updated.status)}.`,
            }),
          )),
        ).catch((err) => console.error("Error creating status-change notifications:", err));
      }
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "A docket with this case number already exists" });
      }
      console.error("Error updating docket:", error);
      res.status(500).json({ message: "Failed to update docket" });
    }
  });

  app.delete("/api/dockets/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid docket ID" });

      const existing = await storage.getDocket(id);
      if (!existing) return res.status(404).json({ message: "Docket not found" });

      const deleted = await storage.deleteDocket(id);
      if (!deleted) return res.status(404).json({ message: "Docket not found" });
      res.status(204).send();
    } catch (error: any) {
      // FK constraint violation — dependent records exist
      if (error?.code === "23503") {
        return res.status(409).json({
          message: "Cannot delete this docket because it has dependent records (e.g. research documents, notifications, or saved drafts). Remove those first.",
        });
      }
      console.error("Error deleting docket:", error);
      res.status(500).json({ message: "Failed to delete docket" });
    }
  });

  // ── Docket Documents ─────────────────────────────────────

  app.get("/api/dockets/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const docketId = parseId(req.params.id);
      if (!docketId) return res.status(400).json({ message: "Invalid docket ID" });
      const docs = await storage.getDocketDocuments(docketId);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching docket documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/dockets/:id/documents", isAuthenticated, requireAdmin, (req: any, res) => {
    const singleUpload = upload.single("file");
    singleUpload(req, res, async (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Maximum size is 50 MB." });
        }
        return res.status(400).json({ message: err.message });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      try {
        const docketId = parseId(req.params.id);
        if (!docketId) return res.status(400).json({ message: "Invalid docket ID" });

        const file = req.file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });

        const docket = await storage.getDocket(docketId);
        if (!docket) {
          fs.unlink(file.path, () => {});
          return res.status(404).json({ message: "Docket not found" });
        }

        const documentType = req.body.documentType || "other";
        if (!documentTypes.includes(documentType)) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ message: `Invalid document type. Accepted: ${documentTypes.join(", ")}` });
        }

        // Move file into docket subdirectory
        const docketDir = path.join(UPLOADS_DIR, String(docketId));
        fs.mkdirSync(docketDir, { recursive: true });
        const finalPath = path.join(docketDir, file.filename);
        fs.renameSync(file.path, finalPath);

        const storageKey = `uploads/${docketId}/${file.filename}`;
        const doc = await storage.createDocketDocument({
          docketId,
          uploadedBy: req.user.claims.sub,
          filename: file.originalname,
          storageKey,
          mimeType: file.mimetype,
          fileSize: file.size,
          documentType,
          description: req.body.description || null,
        });

        res.status(201).json(doc);
      } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => {});
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Failed to upload document" });
      }
    });
  });

  app.get("/api/documents/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid document ID" });
      const doc = await storage.getDocketDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const filePath = path.resolve(process.cwd(), doc.storageKey);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.filename.replace(/"/g, '\\"')}"`);
      res.setHeader("Content-Length", doc.fileSize);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid document ID" });

      const doc = await storage.getDocketDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const deleted = await storage.deleteDocketDocument(id);
      if (!deleted) return res.status(404).json({ message: "Document not found" });

      // Remove file from disk (best-effort)
      const filePath = path.resolve(process.cwd(), doc.storageKey);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete file from disk:", err);
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ── Research ─────────────────────────────────────────────

  app.get("/api/research", async (req, res) => {
    try {
      const pagination = parsePagination(req.query);
      const result = await storage.getResearchDocuments(pagination);
      res.json(result);
    } catch (error) {
      console.error("Error fetching research:", error);
      res.status(500).json({ message: "Failed to fetch research documents" });
    }
  });

  app.get("/api/research/:id", async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid document ID" });
      const doc = await storage.getResearchDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // ── Subscriptions ────────────────────────────────────────

  app.get("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subs = await storage.getSubscriptions(userId);
      res.json(subs);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = createSubscriptionBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }
      const sub = await storage.createSubscription({ userId, docketId: parsed.data.docketId });
      res.status(201).json(sub);
    } catch (error: any) {
      // Handle unique constraint violation (duplicate subscription)
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Already subscribed to this docket" });
      }
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.delete("/api/subscriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid subscription ID" });
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteSubscription(id, userId);
      if (!deleted) return res.status(404).json({ message: "Subscription not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  // ── Notifications ────────────────────────────────────────

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pagination = parsePagination(req.query);
      const result = await storage.getNotifications(userId, pagination);
      res.json(result);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid notification ID" });
      const userId = req.user.claims.sub;
      const updated = await storage.markNotificationRead(id, userId);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications:", error);
      res.status(500).json({ message: "Failed to mark notifications read" });
    }
  });

  // ── Templates & Drafts ──────────────────────────────────

  app.get("/api/templates", async (_req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const drafts = await storage.getSavedDrafts(userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.post("/api/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = createDraftBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }
      const draft = await storage.createSavedDraft({
        userId,
        title: parsed.data.title,
        content: parsed.data.content,
        templateId: parsed.data.templateId ?? null,
        docketId: parsed.data.docketId ?? null,
      });
      res.status(201).json(draft);
    } catch (error) {
      console.error("Error saving draft:", error);
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  // ── AI Draft Generation (SSE with heartbeat) ────────────

  app.post("/api/drafts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = generateDraftBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten().fieldErrors });
      }

      const { prompt, templateId, docketId, existingContent } = parsed.data;

      // System message — contains only trusted, server-controlled content
      const systemMessage = `You are a legal drafting assistant specializing in Georgia Certificate of Need (CON) proceedings. You help attorneys draft filings, responses, briefs, letters of intent, and other legal documents related to Georgia's CON process administered by the Department of Community Health (DCH).

Key Georgia CON knowledge:
- Georgia's CON program is administered by the Healthcare Facility Regulation Division of DCH
- Applications must comply with O.C.G.A. § 31-6 and the rules of the Department of Community Health
- The CON review process involves application filing, staff review, public hearings, and final decisions
- CON is required for new healthcare facilities, bed additions, new services, and major capital expenditures
- The CON review criteria include need, accessibility, quality, cost containment, and financial feasibility

Generate professional, well-structured legal content. This content will be reviewed by a licensed attorney before use.`;

      // Docket context — built from trusted database records
      let docketContext = "";
      if (docketId) {
        const docket = await storage.getDocket(docketId);
        if (docket) {
          docketContext = `\n\nRelated Docket Information:
- Case Number: ${docket.caseNumber}
- Title: ${docket.title}
- Applicant: ${docket.applicant}
- Facility: ${docket.facilityName} (${docket.facilityType})
- County: ${docket.county}
- Status: ${docket.status}
- Description: ${docket.description || "N/A"}`;
        }
      }

      // Template context — built from trusted database records
      let templateContext = "";
      if (templateId) {
        const template = await storage.getTemplate(templateId);
        if (template) {
          templateContext = `\n\nUse this template as a structural guide:\n${template.templateContent}`;
        }
      }

      // User-supplied content goes in the user message, not system message.
      // This prevents prompt injection via existingContent from overriding system instructions.
      let userMessage = prompt;
      if (existingContent) {
        userMessage = `Here is the existing draft content to build upon or refine:\n\n---\n${existingContent}\n---\n\nRequest: ${prompt}`;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Heartbeat to keep connection alive through proxies/load balancers
      const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 15000);

      try {
        const openai = getOpenAI();
        const stream = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: systemMessage + docketContext + templateContext },
            { role: "user", content: userMessage },
          ],
          stream: true,
          max_completion_tokens: 4096,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      } finally {
        clearInterval(heartbeat);
      }

      res.end();
    } catch (error) {
      console.error("Error generating draft:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate draft" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to generate draft" });
      }
    }
  });

  return httpServer;
}
