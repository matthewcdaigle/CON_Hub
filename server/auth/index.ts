import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "../db";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express, RequestHandler } from "express";

const PgStore = connectPgSimple(session);

export function setupAuth(app: Express) {
  // Session middleware
  const sessionMiddleware = session({
    store: new PgStore({
      pool: pool as any,
      tableName: "sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "con-hub-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize/deserialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (err) {
      done(err, null);
    }
  });

  // Google OAuth Strategy (only if credentials are configured)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error("No email found in Google profile"), undefined);
            }

            // Check if user exists by OAuth ID or email
            let [existingUser] = await db
              .select()
              .from(users)
              .where(eq(users.oauthId, profile.id));

            if (!existingUser) {
              [existingUser] = await db
                .select()
                .from(users)
                .where(eq(users.email, email));
            }

            if (existingUser) {
              // Update existing user
              const [updated] = await db
                .update(users)
                .set({
                  firstName: profile.name?.givenName || existingUser.firstName,
                  lastName: profile.name?.familyName || existingUser.lastName,
                  profileImageUrl: profile.photos?.[0]?.value || existingUser.profileImageUrl,
                  oauthProvider: "google",
                  oauthId: profile.id,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, existingUser.id))
                .returning();
              return done(null, updated);
            }

            // Create new user
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileImageUrl: profile.photos?.[0]?.value,
                oauthProvider: "google",
                oauthId: profile.id,
                role: "attorney",
              })
              .returning();

            return done(null, newUser);
          } catch (err) {
            return done(err as Error, undefined);
          }
        }
      )
    );
  }

  // Auth routes
  app.get("/api/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
  }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
    (_req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ message: "Logged out" });
      });
    });
  });

  // Demo login for development
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/auth/demo-login", async (req, res) => {
      try {
        let [demoUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, "demo@conhub.dev"));

        if (!demoUser) {
          [demoUser] = await db
            .insert(users)
            .values({
              email: "demo@conhub.dev",
              firstName: "Demo",
              lastName: "Attorney",
              role: "admin",
              oauthProvider: "demo",
            })
            .returning();
        }

        req.login(demoUser, (err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          return res.json(demoUser);
        });
      } catch (err) {
        return res.status(500).json({ message: "Demo login failed" });
      }
    });
  }
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Authentication required" });
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && (req.user as any)?.role === "admin") return next();
  return res.status(403).json({ message: "Admin access required" });
};
