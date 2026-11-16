# SkillSwap — Learn by Sharing. Grow Together.

SkillSwap is a full-stack peer-to-peer skill exchange platform where students teach skills they know and learn new ones through direct two-way swaps or credit-based sessions.

## Architecture & Live Preview Mode

- **Frontend**: React 19, TypeScript, Vite, React Router, Tailwind CSS v4, Lucide Icons.
- **Database & Auth**:
  - **Production Supabase Stack** (`/supabase/`): Complete PostgreSQL schema (`schema.sql`) with 18 tables, constraints, indexes, Row Level Security (RLS), atomic `confirm_exchange_completion()` PL/pgSQL transaction function with idempotent ledger constraints (`UNIQUE(exchange_id, type)`), auto-awarded badge trigger, Supabase Storage (`avatars` bucket), Realtime (`messages` & `notifications`), `seed.sql`, and Deno Edge Functions (`ai-match`, `generate-roadmap`).
  - **Zero-Config Live Preview Backend** (`server.ts` + `server/`): Because Supabase Cloud project credentials are not pre-provisioned in this preview sandbox, the Express server runs an identical persistent relational SQLite database (`data/skillswap.db`) with bcrypt password authentication, atomic SQLite transactions, Server-Sent Events (SSE) realtime messaging/notifications, local avatar file uploads, and server-side Gemini API calls (`gemini-4-hydrogen`) with deterministic rule-based fallback (`basic mode`).

## Demo Login Credentials

All 9 seeded student accounts share the password **`SkillSwap123!`**:

- `maya@skillswap.edu` (Maya Lin — teaches React & TypeScript, UI/UX Design; learning Acoustic Guitar, Spanish)
- `marcus@skillswap.edu` (Marcus Vance — teaches Acoustic Guitar, Video Editing; learning React, SQL)
- `priya@skillswap.edu` (Priya Nair — teaches Python & Data Science, Calculus & Linear Algebra; learning Public Speaking, Figma)
- `leo@skillswap.edu` (Leo Morales — teaches Conversational Spanish, Digital Photography)
- `elena@skillswap.edu` (Elena Rostova — teaches Public Speaking, Figma)
- `samir@skillswap.edu` (Samir Patel — teaches SQL & Database Design, Python)
- `chloe@skillswap.edu` (Chloe Bennett — teaches Video Editing, Digital Photography)
- `devon@skillswap.edu` (Devon Brooks — teaches Calculus & Linear Algebra)
- `nina@skillswap.edu` (Nina Alvarez — teaches UI/UX Design)

## Environment Variables

Copy `.env.example` to `.env`:

```bash
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"
SESSION_SECRET="replace-with-random-secret"

# Optional: Set these to connect to a live Supabase project
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

## Local Run Instructions

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup & Edge Functions

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run `/supabase/schema.sql`.
3. Create demo Auth users in **Authentication → Users** (or sign up via the app), then run `/supabase/seed.sql` to populate skills and sample profiles.
4. Deploy Edge Functions and set the Gemini secret:
   ```bash
   supabase secrets set GEMINI_API_KEY=your_gemini_key
   supabase functions deploy ai-match
   supabase functions deploy generate-roadmap
   ```
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.

## Deployment (Vercel / Netlify / Node)

- **Full-Stack Node (Render / Railway / Cloud Run)**:
  ```bash
  npm run build
  npm start
  ```
- **Static SPA (Vercel or Netlify with Supabase backend)**:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project environment settings, and add a SPA rewrite rule (`/* -> /index.html`).
