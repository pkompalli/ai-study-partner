# Next.js + Supabase Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `ai-study-partner` from Express + SQLite + Vite/React into a single Next.js 15 App Router project on Vercel, with Supabase handling auth, database, and file storage.

**Architecture:** The `client/` and `server/` directories are replaced by a single Next.js project at the repo root. Express routes become Next.js Route Handlers (`app/api/*/route.ts`). All React components are ported as Client Components (`"use client"`). Supabase Auth replaces custom JWT. `better-sqlite3` is replaced by `@supabase/supabase-js` queries. Puppeteer is removed; PDF export moves to the browser.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, Zustand, Azure OpenAI, Vercel

---

## Prerequisites

Have the following ready before starting:
- Repo cloned at `/Users/shubh/workspace/ai-study-partner`
- Node.js 20+ installed (`node --version`)
- Supabase project URL: `https://cfukxbwukkfldadepjpb.supabase.co`
- Supabase publishable key: `sb_publishable_wwErbjuz2up0W1kdrfHwig__9VCKW-b`
- Supabase service role key: get from Supabase dashboard → Project Settings → API → `service_role` key
- Supabase DB password: already noted
- Azure OpenAI + YouTube API keys from existing `server/.env`

---

## Task 1: Scaffold Next.js 15 project at repo root

**Files:**
- Create: `package.json` (replace root)
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `.env.local`

**Step 1: Initialize Next.js in a temp dir and copy config files**

```bash
cd /tmp && npx create-next-app@latest nextjs-scaffold \
  --typescript --tailwind --app --no-src-dir \
  --no-eslint --import-alias "@/*" --yes
```

**Step 2: Copy scaffold files to the repo**

```bash
cd /Users/shubh/workspace/ai-study-partner
cp /tmp/nextjs-scaffold/next.config.ts .
cp /tmp/nextjs-scaffold/tsconfig.json .
cp /tmp/nextjs-scaffold/postcss.config.mjs .
cp /tmp/nextjs-scaffold/tailwind.config.ts .
mkdir -p app
cp /tmp/nextjs-scaffold/app/globals.css app/
```

**Step 3: Write root `package.json`**

```json
{
  "name": "ai-study-partner",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.49.1",
    "axios": "^1.7.7",
    "katex": "^0.16.33",
    "lucide-react": "^0.462.0",
    "mermaid": "^11.12.3",
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.1",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0",
    "zustand": "^5.0.1",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "express-rate-limit": "^7.4.1",
    "multer": "^1.4.5-lts.1",
    "openai": "^6.22.0",
    "pdf-parse": "^2.4.5",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.15",
    "@types/bcryptjs": "^2.4.6",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.6.3"
  }
}
```

**Step 4: Install dependencies**

```bash
cd /Users/shubh/workspace/ai-study-partner
npm install
```

Expected: `node_modules/` created, no errors.

**Step 5: Write `.env.local`**

```bash
# .env.local — never commit this file
NEXT_PUBLIC_SUPABASE_URL=https://cfukxbwukkfldadepjpb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_wwErbjuz2up0W1kdrfHwig__9VCKW-b
SUPABASE_SERVICE_ROLE_KEY=<paste from Supabase dashboard>
AZURE_OPENAI_ENDPOINT=<from server/.env>
AZURE_OPENAI_API_KEY=<from server/.env>
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01
YOUTUBE_API_KEY=<from server/.env>
```

**Step 6: Add `.env.local` to `.gitignore`**

Verify `.gitignore` already has `.env.local`. If not, add it.

**Step 7: Write `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Study Partner',
  description: 'AI-powered study partner with spaced repetition',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

**Step 8: Verify Next.js starts**

```bash
cd /Users/shubh/workspace/ai-study-partner && npm run dev
```

Expected: server starts on `http://localhost:3000`. Stop with Ctrl+C.

**Step 9: Commit**

```bash
git add package.json next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs app/layout.tsx app/globals.css .env.local
git commit -m "feat: scaffold Next.js 15 app at repo root"
```

---

## Task 2: Run Supabase database migration

**Files:**
- Reference: `supabase/migrations/001_initial_schema.sql`

**Step 1: Open Supabase SQL editor**

Go to [https://supabase.com/dashboard/project/cfukxbwukkfldadepjpb/sql/new](https://supabase.com/dashboard/project/cfukxbwukkfldadepjpb/sql/new)

**Step 2: Run the migration SQL**

Copy the entire contents of `supabase/migrations/001_initial_schema.sql` and paste it into the SQL editor. Click **Run**.

Expected: all tables created — `profiles`, `courses`, `subjects`, `topics`, `chapters`, `study_sessions`, `session_messages`, `quizzes`, `flashcard_sets`, `lesson_artifacts`, `topic_progress`, `topic_cards`, `topic_check_questions`, `exam_formats`, `exam_sections`, `exam_questions`, `exam_attempts`, `exam_attempt_answers`, `chapter_summaries`, `chapter_progress`, `topic_summaries`.

**Step 3: Verify in Table Editor**

Go to Table Editor in Supabase dashboard. Confirm all tables are listed.

**Step 4: No code changes needed. No commit.**

---

## Task 3: Set up Supabase clients + middleware

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

**Step 1: Create `lib/supabase/client.ts`** (browser-side)

```ts
// lib/supabase/client.ts
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )
}
```

**Step 2: Create `lib/supabase/server.ts`** (server-side, for API routes)

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // safe to ignore in Server Components
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**Step 3: Create `middleware.ts`** (session refresh on every request)

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  const isProtected = !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/api')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd /Users/shubh/workspace/ai-study-partner && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts middleware.ts
git commit -m "feat: add Supabase browser/server clients and session middleware"
```

---

## Task 4: Port auth pages (login + signup)

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/auth/callback/route.ts`
- Copy from: `client/src/pages/LandingPage.tsx` → `app/page.tsx`

**Step 1: Create login page**

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSignIn} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" required className="w-full border p-2 rounded"
        />
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" required className="w-full border p-2 rounded"
        />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-center">
          No account? <Link href="/signup" className="text-blue-600">Sign up</Link>
        </p>
      </form>
    </div>
  )
}
```

**Step 2: Create signup page**

```tsx
// app/(auth)/signup/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSignUp} className="w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-bold">Create account</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" required className="w-full border p-2 rounded"
        />
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)" required minLength={6}
          className="w-full border p-2 rounded"
        />
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="text-sm text-center">
          Have an account? <Link href="/login" className="text-blue-600">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
```

**Step 3: Create auth callback route** (handles email confirmation links)

```ts
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

**Step 4: Copy LandingPage as `app/page.tsx`**

```bash
cp /Users/shubh/workspace/ai-study-partner/client/src/pages/LandingPage.tsx \
   /Users/shubh/workspace/ai-study-partner/app/page.tsx
```

Then add `'use client'` as the first line and fix imports:
- Change `import { useNavigate } from 'react-router-dom'` → `import { useRouter } from 'next/navigation'`
- Change `const navigate = useNavigate()` → `const router = useRouter()`
- Change `navigate('/dashboard')` → `router.push('/dashboard')`

**Step 5: Commit**

```bash
git add app/
git commit -m "feat: add auth pages (login, signup, callback) and landing page"
```

---

## Task 5: Port layout components + Zustand auth store

**Files:**
- Copy: `client/src/components/layout/` → `components/layout/`
- Copy: `client/src/components/auth/` → `components/auth/`
- Copy: `client/src/store/` → `store/`
- Copy: `client/src/lib/` → `lib/` (merge with existing)
- Copy: `client/src/types/` → `types/`
- Copy: `client/src/hooks/` → `hooks/`
- Modify: `store/authStore.ts`

**Step 1: Copy all client source directories**

```bash
cd /Users/shubh/workspace/ai-study-partner
cp -r client/src/components components
cp -r client/src/store store
cp -r client/src/hooks hooks
cp -r client/src/types types
cp -r client/src/lib/utils.ts lib/utils.ts
# Note: lib/api.ts uses axios to call the server — keep it, update NEXT_PUBLIC_API_BASE_URL later
cp client/src/lib/api.ts lib/api.ts
```

**Step 2: Add `"use client"` to all copied component files**

All components from the Vite app are Client Components in Next.js. Add `'use client'` as the first line to every `.tsx` file in `components/`, `store/`, and `hooks/`.

```bash
# Add "use client" to all tsx files in components/, store/, hooks/
find components store hooks -name "*.tsx" -o -name "*.ts" | while read f; do
  if ! grep -q '"use client"' "$f" && ! grep -q "'use client'" "$f"; then
    sed -i '' "1s/^/'use client'\n/" "$f"
  fi
done
```

**Step 3: Replace `store/authStore.ts` entirely** — swap the dev stub for real Supabase Auth

```ts
// store/authStore.ts
'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  init: () => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    set({
      user: user ? { id: user.id, email: user.email!, name: user.user_metadata?.name } : null,
      loading: false,
    })
    // Listen for auth changes (sign in / sign out)
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      set({ user: u ? { id: u.id, email: u.email!, name: u.user_metadata?.name } : null })
    })
  },

  signUp: async (email, password, name) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } },
    })
    if (error) throw error
    const u = data.user!
    set({ user: { id: u.id, email: u.email!, name } })
  },

  signIn: async (email, password) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const u = data.user
    set({ user: { id: u.id, email: u.email!, name: u.user_metadata?.name } })
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
```

**Step 4: Update `lib/api.ts`**

Replace the `baseURL` to use the Next.js API routes (same origin, no separate server):

```ts
// lib/api.ts
import axios from 'axios'

const api = axios.create({ baseURL: '' }) // same origin — /api/... routes

api.interceptors.request.use(async (config) => {
  // No token needed — Supabase uses cookies, handled by @supabase/ssr
  return config
})

export default api
```

**Step 5: Fix React Router imports in components**

In Next.js, replace `react-router-dom` navigation with `next/navigation`:
```bash
# Find all files using react-router-dom
grep -rl "react-router-dom" components store hooks
```
For each file found:
- `useNavigate` → `useRouter` from `next/navigation`
- `useParams` → `useParams` from `next/navigation`
- `useLocation` → `usePathname` / `useSearchParams` from `next/navigation`
- `<Link>` from react-router-dom → `<Link>` from `next/link`
- `navigate('/path')` → `router.push('/path')`

**Step 6: Commit**

```bash
git add components store hooks types lib/utils.ts lib/api.ts
git commit -m "feat: port client components, stores, and hooks to Next.js"
```

---

## Task 6: Port all page components

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `app/onboarding/page.tsx`
- Create: `app/courses/[id]/page.tsx`
- Create: `app/courses/[id]/settings/page.tsx`
- Create: `app/settings/page.tsx`
- Create: `app/sessions/[id]/page.tsx`
- Create: `app/artifacts/[id]/page.tsx`

**Step 1: Copy each page from `client/src/pages/` to the correct `app/` path**

Map:
```
LandingPage.tsx          → app/page.tsx           (done in Task 4)
DashboardPage.tsx        → app/dashboard/page.tsx
OnboardingPage.tsx       → app/onboarding/page.tsx
CoursePage.tsx           → app/courses/[id]/page.tsx
CourseSettingsPage.tsx   → app/courses/[id]/settings/page.tsx
SettingsPage.tsx         → app/settings/page.tsx
SessionPage.tsx          → app/sessions/[id]/page.tsx
ArtifactPage.tsx         → app/artifacts/[id]/page.tsx
```

```bash
mkdir -p app/dashboard app/onboarding "app/courses/[id]/settings" \
  app/settings "app/sessions/[id]" "app/artifacts/[id]"

cp client/src/pages/DashboardPage.tsx app/dashboard/page.tsx
cp client/src/pages/OnboardingPage.tsx app/onboarding/page.tsx
cp client/src/pages/CoursePage.tsx "app/courses/[id]/page.tsx"
cp client/src/pages/CourseSettingsPage.tsx "app/courses/[id]/settings/page.tsx"
cp client/src/pages/SettingsPage.tsx app/settings/page.tsx
cp client/src/pages/SessionPage.tsx "app/sessions/[id]/page.tsx"
cp client/src/pages/ArtifactPage.tsx "app/artifacts/[id]/page.tsx"
```

**Step 2: Add `'use client'` to each page file**

Each page in `app/` that uses hooks, state, or browser APIs needs `'use client'` as its first line.

**Step 3: Fix React Router param access**

In React Router: `const { id } = useParams()`
In Next.js (App Router): `const params = useParams(); const id = params.id as string`

Search for `useParams` in all page files and update accordingly.

**Step 4: Fix `useNavigate` → `useRouter`** (same as Task 5, Step 5)

**Step 5: Fix `<AppShell>` nesting**

In `App.tsx`, `<AppShell>` wraps protected routes. In Next.js, create a layout file:

```tsx
// app/(app)/layout.tsx
'use client'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}
```

Move all protected pages into `app/(app)/`:
```bash
mkdir -p "app/(app)"
mv app/dashboard "app/(app)/dashboard"
mv app/onboarding "app/(app)/onboarding"
mv "app/courses" "app/(app)/courses"
mv app/settings "app/(app)/settings"
mv "app/sessions" "app/(app)/sessions"
mv "app/artifacts" "app/(app)/artifacts"
```

**Step 6: Commit**

```bash
git add app/
git commit -m "feat: port all page components to Next.js app router"
```

---

## Task 7: Implement Supabase database query layer

**Files:**
- Create: `lib/db/courses.db.ts`
- Create: `lib/db/sessions.db.ts`
- Create: `lib/db/artifacts.db.ts`
- Create: `lib/db/examBank.db.ts`
- Create: `lib/db/topicBank.db.ts`

Reference: `server/src/db/*.ts` for the same function signatures — rewrite bodies using `@supabase/supabase-js`.

**Step 1: Create `lib/db/courses.db.ts`**

This file replaces `server/src/db/courses.db.ts`. Read the original, then rewrite each function replacing `db.prepare(sql).run(...)` with `await supabase.from('table').insert/select/update/delete()`.

Key pattern to follow for every function:
```ts
// BEFORE (SQLite — synchronous)
export function getCourse(id: string, userId: string) {
  return db.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').get(id, userId)
}

// AFTER (Supabase — async)
import { createServiceClient } from '@/lib/supabase/server'

export async function getCourse(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}
```

Write `lib/db/courses.db.ts` by following this pattern for every function in `server/src/db/courses.db.ts`.

**Step 2: Repeat for `lib/db/sessions.db.ts`**

Follow the same pattern. Read `server/src/db/sessions.db.ts` and rewrite with Supabase client.

**Step 3: Repeat for `lib/db/artifacts.db.ts`**

Follow the same pattern. Read `server/src/db/artifacts.db.ts` and rewrite.

**Step 4: Repeat for `lib/db/examBank.db.ts`**

Follow the same pattern. Read `server/src/db/examBank.db.ts` and rewrite.

**Step 5: Repeat for `lib/db/topicBank.db.ts`**

Follow the same pattern. Read `server/src/db/topicBank.db.ts` and rewrite.

**Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/db/`.

**Step 7: Commit**

```bash
git add lib/db/
git commit -m "feat: implement Supabase database query layer (replaces SQLite)"
```

---

## Task 8: Implement Supabase Storage layer

**Files:**
- Create: `lib/storage.ts`

**Step 1: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New Bucket → name: `artifacts`, public: true.

**Step 2: Write `lib/storage.ts`**

```ts
// lib/storage.ts
import { createServiceClient } from '@/lib/supabase/server'

export async function uploadFile(
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return publicUrl
}

export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.storage.from(bucket).remove([filePath])
}
```

**Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: implement Supabase Storage layer (replaces local uploads dir)"
```

---

## Task 9: Port LLM and YouTube services

**Files:**
- Copy: `server/src/services/llm/` → `lib/llm/`
- Copy: `server/src/services/youtube.ts` → `lib/youtube.ts`
- Copy: `server/src/config/azureOpenAI.ts` → `lib/config/azureOpenAI.ts`
- Copy: `server/src/config/env.ts` → `lib/config/env.ts` (update for Next.js env)

**Step 1: Copy LLM services**

```bash
mkdir -p lib/llm lib/config
cp -r server/src/services/llm/* lib/llm/
cp server/src/services/youtube.ts lib/youtube.ts
cp server/src/config/azureOpenAI.ts lib/config/azureOpenAI.ts
```

**Step 2: Copy and update `lib/config/env.ts`**

Copy `server/src/config/env.ts` to `lib/config/env.ts`. Update env variable names to match `.env.local`:
- Remove `DATABASE_PATH`, `UPLOADS_DIR`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`
- Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

```ts
// lib/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AZURE_OPENAI_ENDPOINT: z.string().optional().or(z.literal('')),
  AZURE_OPENAI_API_KEY: z.string().optional().or(z.literal('')),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().default('gpt-4o'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-02-01'),
  YOUTUBE_API_KEY: z.string().optional().or(z.literal('')),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
}

export const env = parsed.data!
```

**Step 3: Fix import paths in LLM service files**

LLM files import from `../config/env` — update to `@/lib/config/env`.

```bash
sed -i '' 's|../config/env|@/lib/config/env|g' lib/llm/*.ts
sed -i '' 's|../config/azureOpenAI|@/lib/config/azureOpenAI|g' lib/llm/*.ts
```

**Step 4: Commit**

```bash
git add lib/llm lib/youtube.ts lib/config/
git commit -m "feat: port LLM and YouTube services"
```

---

## Task 10: Implement Next.js API routes

**Files:**
- Create: `app/api/courses/route.ts`
- Create: `app/api/courses/[id]/route.ts`
- Create: `app/api/courses/[id]/progress/route.ts`
- Create: `app/api/courses/extract/route.ts`
- Create: `app/api/sessions/route.ts`
- Create: `app/api/sessions/[id]/route.ts`
- Create: `app/api/artifacts/route.ts`
- Create: `app/api/artifacts/[id]/route.ts`
- Create: `app/api/quizzes/route.ts`
- Create: `app/api/quizzes/[id]/route.ts`
- Create: `app/api/exam/route.ts`
- Create: `app/api/exam/[id]/route.ts`

Reference: `server/src/routes/*.ts` + `server/src/controllers/*.ts` — combine into Route Handlers.

**Step 1: Create auth helper for API routes**

```ts
// lib/auth.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user, error: null }
}
```

**Step 2: Pattern for every API route**

Each Express route+controller combination becomes a single Route Handler file. Example:

```ts
// app/api/courses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { listCourses, saveCourse } from '@/lib/db/courses.db'

export async function GET(_req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  const courses = await listCourses(user!.id)
  return NextResponse.json(courses)
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error
  const body = await req.json()
  const courseId = await saveCourse(user!.id, body)
  return NextResponse.json({ id: courseId }, { status: 201 })
}
```

**Step 3: Implement each route file**

For each route, read the corresponding `server/src/routes/*.ts` and `server/src/controllers/*.ts`, then write the Route Handler combining the logic. Follow the GET/POST/PATCH/DELETE export pattern.

Implement in this order:
1. `app/api/courses/route.ts` — GET list, POST create
2. `app/api/courses/extract/route.ts` — POST (calls LLM course extractor)
3. `app/api/courses/[id]/route.ts` — GET single, PATCH update, DELETE
4. `app/api/courses/[id]/progress/route.ts` — GET
5. `app/api/sessions/route.ts` — GET list, POST create
6. `app/api/sessions/[id]/route.ts` — GET single, PATCH, streaming SSE for AI
7. `app/api/artifacts/route.ts` — GET list
8. `app/api/artifacts/[id]/route.ts` — GET single (no PDF export route — removed)
9. `app/api/quizzes/route.ts` — GET list, POST create
10. `app/api/quizzes/[id]/route.ts` — GET, PATCH (submit answers)
11. `app/api/exam/route.ts` — GET, POST
12. `app/api/exam/[id]/route.ts` — GET, POST (attempts)

**Step 4: Handle file uploads for course extraction**

The course extract route uses `multer` for PDF uploads. In Next.js App Router:

```ts
// app/api/courses/extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { extractCourseFromContent } from '@/lib/llm/courseExtractor'

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null

  let content = text ?? ''
  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer())
    // pdf-parse handles the buffer directly
    const pdfParse = (await import('pdf-parse')).default
    const parsed = await pdfParse(buffer)
    content = parsed.text
  }

  const structure = await extractCourseFromContent(content, user!.id)
  return NextResponse.json(structure)
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors before committing.

**Step 6: Commit**

```bash
git add app/api/ lib/auth.ts
git commit -m "feat: implement all Next.js API route handlers"
```

---

## Task 11: Add client-side PDF export

**Files:**
- Create: `components/artifact/ExportPDFButton.tsx`
- Modify: `app/(app)/artifacts/[id]/page.tsx`

**Step 1: Create `ExportPDFButton` component**

```tsx
// components/artifact/ExportPDFButton.tsx
'use client'

interface Props {
  title: string
  markdownContent: string
}

function markdownToHTML(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
}

export function ExportPDFButton({ title, markdownContent }: Props) {
  const handleExport = () => {
    const html = markdownToHTML(markdownContent)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>${title}</title>
      <style>
        body { font-family: Georgia, serif; line-height: 1.7; color: #1a1a1a;
               max-width: 800px; margin: 0 auto; padding: 2cm; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
        h2 { color: #1d4ed8; margin-top: 32px; }
        h3 { color: #2563eb; }
        code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        ul { padding-left: 24px; } li { margin-bottom: 6px; }
        @media print { body { padding: 0; } }
      </style>
    </head><body><p>${html}</p></body></html>`)
    win.document.close()
    win.print()
  }

  return (
    <button onClick={handleExport}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
      Export PDF
    </button>
  )
}
```

**Step 2: Add `ExportPDFButton` to the Artifact page**

In `app/(app)/artifacts/[id]/page.tsx`, find where the existing PDF export button/link is and replace it with `<ExportPDFButton title={artifact.title} markdownContent={artifact.markdown_content} />`.

**Step 3: Commit**

```bash
git add components/artifact/ExportPDFButton.tsx "app/(app)/artifacts/[id]/page.tsx"
git commit -m "feat: add client-side PDF export (removes Puppeteer)"
```

---

## Task 12: Add `vercel.json` and clean up

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Delete: `client/`
- Delete: `server/`

**Step 1: Create `vercel.json`**

```json
{
  "functions": {
    "app/api/**": { "maxDuration": 60 }
  }
}
```

**Step 2: Create `.env.example`**

```bash
# .env.example — copy to .env.local and fill in values
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-01
YOUTUBE_API_KEY=your-youtube-api-key
```

**Step 3: Remove old directories**

```bash
cd /Users/shubh/workspace/ai-study-partner
rm -rf client server
```

**Step 4: Run final build check**

```bash
npm run build
```

Expected: build completes with no TypeScript errors. Fix any remaining issues before committing.

**Step 5: Final commit**

```bash
git add vercel.json .env.example
git rm -r client server
git commit -m "feat: complete Next.js + Supabase migration — remove Express server and Vite client"
```

---

## Task 13: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Import on Vercel**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `pkompalli/ai-study-partner` GitHub repo
3. Framework: Next.js (auto-detected)
4. Root Directory: `.` (repo root)

**Step 3: Set environment variables**

In Vercel project → Settings → Environment Variables, add all vars from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`
- `YOUTUBE_API_KEY`

**Step 4: Deploy**

Click Deploy. Wait for build to complete.

Expected: app live at `https://ai-study-partner-<hash>.vercel.app`

**Step 5: Update Supabase Auth redirect URL**

In Supabase dashboard → Authentication → URL Configuration:
- Site URL: `https://your-vercel-url.vercel.app`
- Redirect URLs: `https://your-vercel-url.vercel.app/auth/callback`

**Done.** The app is fully deployed on Vercel with Supabase for auth, database, and storage.
