# Design: Next.js + Supabase Migration

**Date:** 2026-02-25
**Status:** Approved

## Overview

Migrate `ai-study-partner` from a split `client/` (React/Vite) + `server/` (Express + SQLite) monorepo into a single **Next.js 15 App Router** project deployed on **Vercel**, with **Supabase** handling auth, database, and file storage.

---

## Architecture

### Before
```
client/   — React + Vite + React Router + Zustand
server/   — Express + TypeScript + better-sqlite3 + custom JWT auth
```

### After
```
ai-study-partner/      — single Next.js 15 project
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/page.tsx
│   ├── courses/[id]/page.tsx
│   └── api/                   ← replaces all Express routes 1:1
│       ├── courses/route.ts
│       ├── sessions/route.ts
│       ├── artifacts/route.ts
│       ├── quizzes/route.ts
│       └── exam/route.ts
├── components/                ← ported from client/src/components ("use client")
├── lib/
│   ├── supabase/
│   │   ├── client.ts          ← browser Supabase client (createBrowserClient)
│   │   └── server.ts          ← server-side Supabase client (createServerClient)
│   ├── db/                    ← replaces server/src/db/*.ts (Supabase queries)
│   └── storage.ts             ← replaces server/src/services/storage.ts
├── middleware.ts               ← Supabase session refresh on every request
└── vercel.json
```

**Deleted entirely:** `client/`, `server/`, root workspace `package.json`

---

## Auth

**Provider:** Supabase Auth — email + password only (Google OAuth deferred to later)

**Flow:**
- Sign up: `supabase.auth.signUp({ email, password })` → confirmation email → session
- Sign in: `supabase.auth.signInWithPassword({ email, password })` → session cookie
- Sign out: `supabase.auth.signOut()` → cookie cleared → redirect to `/login`
- Session refresh: `middleware.ts` refreshes the cookie on every request via `@supabase/ssr`

**What's removed:** custom bcrypt users table, JWT generation, `requireAuth` Express middleware

**API route auth pattern:**
```ts
const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

---

## Database

**Provider:** Supabase PostgreSQL

**Schema:** Run existing `supabase/migrations/001_initial_schema.sql` — no changes needed. The `profiles` table already maps to `auth.users(id)`.

**Query layer:** `server/src/db/*.ts` (synchronous `better-sqlite3`) → `lib/db/*.ts` (async Supabase client queries via `supabase.from().select/insert/update/delete()`)

**Connection:** Service role key used server-side only (API routes), never exposed to the browser.

---

## File Storage

**Provider:** Supabase Storage, bucket: `artifacts`

**`lib/storage.ts`** replaces `server/src/services/storage.ts`:
```ts
export async function uploadFile(bucket, path, buffer, contentType) {
  const { data } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })
  return supabase.storage.from(bucket).getPublicUrl(data!.path).data.publicUrl
}

export async function deleteFile(bucket, path) {
  await supabase.storage.from(bucket).remove([path])
}
```

All callers (`artifacts.controller`) stay identical — only the implementation changes.

---

## PDF Export

**Approach:** Client-side browser print (Puppeteer removed entirely)

The `POST /api/artifacts/:id/export/pdf` endpoint is deleted. An `ExportPDFButton` component opens a new window with styled HTML and triggers `window.print()`.

**Removed dependencies:** `puppeteer`, `pdf-to-img`, `better-sqlite3`

---

## Vercel Deployment

### `vercel.json`
```json
{
  "functions": {
    "app/api/**": { "maxDuration": 60 }
  }
}
```

60s timeout covers slow LLM calls (AI study sessions, exam generation).

### Environment Variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Public | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Private | Server-only, never in browser |
| `AZURE_OPENAI_ENDPOINT` | Private | |
| `AZURE_OPENAI_API_KEY` | Private | |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Private | Default: `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | Private | Default: `2024-02-01` |
| `YOUTUBE_API_KEY` | Private | |

**Removed:** `JWT_SECRET`, `DATABASE_PATH`, `UPLOADS_DIR`, `PORT`, `CORS_ORIGIN`

---

## What Stays the Same

- All React UI components (ported as Client Components with `"use client"`)
- LLM service (`server/src/services/llm/`)
- YouTube service (`server/src/services/youtube.ts`)
- All Zod validation schemas
- Rate limiting middleware (re-implemented as Next.js middleware)
- Business logic in all controllers (just async/await DB calls change)

---

## Migration Approach (Approach B — Client Components)

All existing React components are ported as Client Components. No Server Components or Server Actions in this migration — those are a future optimization. This keeps the migration predictable and the component code nearly identical to the original.
