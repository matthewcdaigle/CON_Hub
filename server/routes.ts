import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import {
  insertDocketSubscriptionSchema,
  insertSavedDraftSchema,
} from "@shared/schema";
import OpenAI from "openai";

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
      const pagination = parsePagination(req.query);
      const result = await storage.getDockets(pagination);
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

  // ── Case Briefs ──────────────────────────────────────────

  app.get("/api/case-briefs", async (_req, res) => {
    try {
      const briefs = await storage.getCaseBriefs();
      res.json(briefs);
    } catch (error) {
      console.error("Error fetching case briefs:", error);
      res.status(500).json({ message: "Failed to fetch case briefs" });
    }
  });

  app.get("/api/case-briefs/docket/:docketId", async (req, res) => {
    try {
      const docketId = parseId(req.params.docketId);
      if (!docketId) return res.status(400).json({ message: "Invalid docket ID" });
      const brief = await storage.getCaseBriefByDocket(docketId);
      if (!brief) return res.status(404).json({ message: "No case brief found for this docket" });
      res.json(brief);
    } catch (error) {
      console.error("Error fetching case brief:", error);
      res.status(500).json({ message: "Failed to fetch case brief" });
    }
  });

  app.post("/api/case-briefs", isAuthenticated, async (req: any, res) => {
    try {
      const { docketId, summary, decisionIssues, appellateIssues, judicialReview } = req.body;
      if (!docketId || !summary || !decisionIssues || !appellateIssues || !judicialReview) {
        return res.status(400).json({ message: "All brief fields are required" });
      }
      const brief = await storage.createCaseBrief({
        docketId,
        summary,
        decisionIssues,
        appellateIssues,
        judicialReview,
      });
      res.status(201).json(brief);
    } catch (error) {
      console.error("Error creating case brief:", error);
      res.status(500).json({ message: "Failed to create case brief" });
    }
  });

  app.post("/api/case-briefs/generate", isAuthenticated, async (req: any, res) => {
    try {
      const docketId = parseId(req.body.docketId);
      if (!docketId) return res.status(400).json({ message: "Invalid docket ID" });

      const docket = await storage.getDocket(docketId);
      if (!docket) return res.status(404).json({ message: "Docket not found" });

      const events = await storage.getDocketEvents(docketId);

      const eventsText = events.map(e =>
        `- ${e.eventDate instanceof Date ? e.eventDate.toISOString().split("T")[0] : e.eventDate}: ${e.title} (${e.eventType})${e.description ? ` — ${e.description}` : ""}`
      ).join("\n");

      const systemPrompt = `You are a legal analyst specializing in Georgia Certificate of Need (CON) proceedings under O.C.G.A. § 31-6. Generate a comprehensive 1-2 page case brief for the following CON docket.

The brief MUST be structured into exactly four sections with these exact headings:

## CASE SUMMARY
Provide a concise overview of the case including the applicant, facility, project description, relevant dates, current status, and key facts.

## MAIN ISSUES AT THE DECISION LEVEL
Identify and analyze the primary issues the Department of Community Health must evaluate in rendering its decision. Consider the CON review criteria: need, accessibility, quality of care, cost containment, and financial feasibility. Discuss how each criterion applies to this specific case.

## APPELLATE ISSUES
Identify potential grounds for appeal regardless of the decision outcome. Consider procedural issues, substantive challenges to need methodology, adequacy of the record, and any constitutional or statutory interpretation questions. Discuss the standard of review applicable to CON appeals under Georgia law.

## JUDICIAL REVIEW PROCEEDINGS
Outline the judicial review process available under Georgia law. Discuss venue, timing requirements, scope of review, burden of proof, and any relevant precedent that could affect judicial review of this particular case.

Write in a professional, analytical legal tone. Be specific to the facts of this case. Reference O.C.G.A. § 31-6 provisions where applicable.`;

      const userPrompt = `Generate a case brief for:

Case Number: ${docket.caseNumber}
Title: ${docket.title}
Applicant: ${docket.applicant}
Facility: ${docket.facilityName} (${docket.facilityType})
County: ${docket.county}
Status: ${docket.status.replace(/_/g, " ")}
Filing Date: ${docket.filingDate}
${docket.hearingDate ? `Hearing Date: ${docket.hearingDate}` : ""}
${docket.decisionDate ? `Decision Date: ${docket.decisionDate}` : ""}
Estimated Cost: ${docket.estimatedCost || "Not specified"}
Description: ${docket.description || "Not provided"}

Timeline Events:
${eventsText || "No events recorded"}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
      }, 15000);

      try {
        const openai = getOpenAI();
        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: true,
          max_completion_tokens: 4096,
        });

        let fullContent = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        // Parse sections from the generated content
        const sections = parseBriefSections(fullContent);

        // Save to database
        const brief = await storage.createCaseBrief({
          docketId,
          summary: sections.summary,
          decisionIssues: sections.decisionIssues,
          appellateIssues: sections.appellateIssues,
          judicialReview: sections.judicialReview,
        });

        res.write(`data: ${JSON.stringify({ done: true, briefId: brief.id })}\n\n`);
      } finally {
        clearInterval(heartbeat);
      }

      res.end();
    } catch (error) {
      console.error("Error generating case brief:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate case brief" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: "Failed to generate case brief" });
      }
    }
  });

  return httpServer;
}

function parseBriefSections(content: string) {
  const sectionPatterns = [
    { key: "summary", pattern: /##\s*CASE\s*SUMMARY\s*\n([\s\S]*?)(?=##\s*MAIN\s*ISSUES|$)/i },
    { key: "decisionIssues", pattern: /##\s*MAIN\s*ISSUES\s*AT\s*THE\s*DECISION\s*LEVEL\s*\n([\s\S]*?)(?=##\s*APPELLATE\s*ISSUES|$)/i },
    { key: "appellateIssues", pattern: /##\s*APPELLATE\s*ISSUES\s*\n([\s\S]*?)(?=##\s*JUDICIAL\s*REVIEW|$)/i },
    { key: "judicialReview", pattern: /##\s*JUDICIAL\s*REVIEW\s*PROCEEDINGS\s*\n([\s\S]*?)$/i },
  ];

  const result: Record<string, string> = {
    summary: "",
    decisionIssues: "",
    appellateIssues: "",
    judicialReview: "",
  };

  for (const { key, pattern } of sectionPatterns) {
    const match = content.match(pattern);
    result[key] = match ? match[1].trim() : "";
  }

  // Fallback: if parsing fails, put everything in summary
  if (!result.summary && !result.decisionIssues) {
    result.summary = content;
    result.decisionIssues = "See case summary above.";
    result.appellateIssues = "See case summary above.";
    result.judicialReview = "See case summary above.";
  }

  return result;
}
