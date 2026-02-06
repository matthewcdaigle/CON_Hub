# GA CON Counsel

## Overview

GA CON Counsel is a full-stack web application built for Georgia Certificate of Need (CON) legal practitioners. It provides tools to track healthcare facility dockets, research legal precedents, draft filings with AI assistance, and manage alerts/notifications. The app is domain-specific to Georgia's CON regulatory process, which governs the establishment and expansion of healthcare facilities.

Core features:
- **Docket Tracking** — Browse, search, and filter CON dockets by status, county, and facility type
- **Docket Detail & Timeline** — View individual docket details with event history
- **Research Library** — Search and filter legal research documents (statutes, regulations, decisions, etc.)
- **AI-Powered Drafting** — Generate legal drafts using OpenAI with template support
- **Alerts & Subscriptions** — Subscribe to docket updates and receive notifications
- **Authentication** — Replit Auth (OpenID Connect) for user management

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; local React state for UI
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with HMR in development
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

The frontend follows a page-based architecture with a sidebar layout for authenticated users and a separate landing page for unauthenticated visitors. All API communication uses fetch with credentials included.

### Backend
- **Framework**: Express.js on Node.js with TypeScript
- **Runtime**: tsx for development, esbuild for production bundling
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **AI Integration**: OpenAI SDK configured via Replit AI Integrations environment variables (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Entry Point**: `server/index.ts` creates HTTP server, registers routes, serves static files in production or sets up Vite middleware in development

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (imports from `shared/models/auth.ts` and `shared/models/chat.ts`)
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema synchronization
- **Session Store**: PostgreSQL-backed sessions via `connect-pg-simple`
- **Storage Pattern**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class using Drizzle queries

Key database tables:
- `users` and `sessions` — Replit Auth (mandatory, do not drop)
- `dockets` — CON case dockets with status enum, dates, and metadata
- `docket_events` — Timeline events per docket
- `research_documents` — Legal research library
- `docket_subscriptions` — User subscriptions to docket updates
- `notifications` — User notification feed
- `draft_templates` and `saved_drafts` — AI drafting system
- `conversations` and `messages` — Chat/AI conversation history

### Authentication
- **Method**: Replit Auth via OpenID Connect
- **Implementation**: `server/replit_integrations/auth/` — uses Passport.js with OIDC strategy
- **Session**: Express sessions stored in PostgreSQL `sessions` table
- **Protected Routes**: `isAuthenticated` middleware checks for valid session
- **User Sync**: Users are upserted on login via `authStorage.upsertUser()`

### Replit Integrations
The `server/replit_integrations/` and `client/replit_integrations/` directories contain modular integrations:
- **auth/** — Replit Auth (OpenID Connect + Passport + session management)
- **chat/** — Conversation storage and streaming chat routes using OpenAI
- **audio/** — Voice recording, playback, speech-to-text, and text-to-speech
- **image/** — Image generation via OpenAI's gpt-image-1 model
- **batch/** — Batch processing utilities with rate limiting and retries

### Build Process
- **Development**: `npm run dev` runs tsx with Vite middleware for HMR
- **Production Build**: `npm run build` runs `script/build.ts` which builds the Vite frontend to `dist/public/` and bundles the server with esbuild to `dist/index.cjs`
- **Production Start**: `npm start` runs the compiled `dist/index.cjs`
- **Database**: `npm run db:push` pushes schema changes to PostgreSQL

### Seed Data
`server/seed.ts` populates the database with sample CON dockets, events, research documents, and draft templates on first run.

## External Dependencies

### Required Services
- **PostgreSQL** — Primary database (connection via `DATABASE_URL` environment variable)
- **OpenAI API** — AI features for drafting, chat, image generation, and voice (via Replit AI Integrations with `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Replit Auth** — Authentication provider (requires `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`)

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — Database ORM and migration tooling
- **express** + **express-session** — HTTP server and session management
- **passport** + **openid-client** — Authentication
- **openai** — AI API client
- **@tanstack/react-query** — Client-side data fetching and caching
- **wouter** — Client-side routing
- **shadcn/ui** ecosystem — Radix UI, Tailwind CSS, class-variance-authority, cmdk
- **date-fns** — Date formatting
- **zod** + **drizzle-zod** — Schema validation
- **connect-pg-simple** — PostgreSQL session store
- **ffmpeg** (system dependency) — Required for audio format conversion in voice features