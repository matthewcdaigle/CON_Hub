import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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

  app.get("/api/dockets", async (_req, res) => {
    try {
      const dockets = await storage.getDockets();
      res.json(dockets);
    } catch (error) {
      console.error("Error fetching dockets:", error);
      res.status(500).json({ message: "Failed to fetch dockets" });
    }
  });

  app.get("/api/dockets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
      const events = await storage.getDocketEvents(id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/research", async (_req, res) => {
    try {
      const docs = await storage.getResearchDocuments();
      res.json(docs);
    } catch (error) {
      console.error("Error fetching research:", error);
      res.status(500).json({ message: "Failed to fetch research documents" });
    }
  });

  app.get("/api/research/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await storage.getResearchDocument(id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      res.json(doc);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

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
      const { docketId } = req.body;
      const sub = await storage.createSubscription({ userId, docketId });
      res.status(201).json(sub);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.delete("/api/subscriptions/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSubscription(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifs = await storage.getNotifications(userId);
      res.json(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markNotificationRead(id);
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
      const { title, content, templateId, docketId } = req.body;
      const draft = await storage.createSavedDraft({
        userId,
        title,
        content,
        templateId: templateId || null,
        docketId: docketId || null,
      });
      res.status(201).json(draft);
    } catch (error) {
      console.error("Error saving draft:", error);
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  app.post("/api/drafts/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { prompt, templateId, docketId, existingContent } = req.body;

      let context = `You are a legal drafting assistant specializing in Georgia Certificate of Need (CON) proceedings. You help attorneys draft filings, responses, briefs, letters of intent, and other legal documents related to Georgia's CON process administered by the Department of Community Health (DCH).

Key Georgia CON knowledge:
- Georgia's CON program is administered by the Healthcare Facility Regulation Division of DCH
- Applications must comply with O.C.G.A. § 31-6 and the rules of the Department of Community Health
- The CON review process involves application filing, staff review, public hearings, and final decisions
- CON is required for new healthcare facilities, bed additions, new services, and major capital expenditures
- The CON review criteria include need, accessibility, quality, cost containment, and financial feasibility

Generate professional, well-structured legal content.`;

      if (existingContent) {
        context += `\n\nExisting draft content to build upon or refine:\n${existingContent}`;
      }

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

      let templateContext = "";
      if (templateId) {
        const template = await storage.getTemplate(templateId);
        if (template) {
          templateContext = `\n\nUse this template as a structural guide:\n${template.templateContent}`;
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: context + docketContext + templateContext },
          { role: "user", content: prompt },
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
