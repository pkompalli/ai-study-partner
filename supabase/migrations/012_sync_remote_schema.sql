-- ============================================================
-- Migration: Sync remote DB with local schema
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Add missing columns to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS goal TEXT DEFAULT 'classwork',
  ADD COLUMN IF NOT EXISTS exam_name TEXT,
  ADD COLUMN IF NOT EXISTS year_of_study TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_file_url TEXT,
  ADD COLUMN IF NOT EXISTS raw_input TEXT,
  ADD COLUMN IF NOT EXISTS structure JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 2. Add missing columns to subjects table
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 3. Add missing columns to topics table
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4. Create chapters table (does not exist on remote)
CREATE TABLE IF NOT EXISTS public.chapters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id  UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create topic_progress table
CREATE TABLE IF NOT EXISTS public.topic_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id       UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  sessions_count INTEGER DEFAULT 0,
  last_studied   TIMESTAMPTZ,
  UNIQUE(user_id, topic_id)
);

-- 6. Create study_sessions table
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id   UUID REFERENCES public.topics(id),
  chapter_id UUID REFERENCES public.chapters(id),
  subject_id UUID REFERENCES public.subjects(id),
  title      TEXT,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  metadata   JSONB DEFAULT '{}'
);

-- 7. Create session_messages table
CREATE TABLE IF NOT EXISTS public.session_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create summary_cache table
CREATE TABLE IF NOT EXISTS public.summary_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_type  TEXT NOT NULL CHECK (summary_type IN ('topic', 'chapter')),
  content       TEXT NOT NULL,
  model_version TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic_id, user_id, summary_type)
);

-- 9. Create exam_formats table
CREATE TABLE IF NOT EXISTS public.exam_formats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  total_marks  INTEGER,
  time_minutes INTEGER,
  instructions TEXT,
  sections     JSONB NOT NULL DEFAULT '[]',
  is_default   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create exam_dates table
CREATE TABLE IF NOT EXISTS public.exam_dates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  exam_date   DATE NOT NULL,
  notes       TEXT,
  chapter_ids UUID[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create study_plan_items table
CREATE TABLE IF NOT EXISTS public.study_plan_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  chapter_id  UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  plan_date   DATE NOT NULL,
  duration_min INTEGER DEFAULT 30,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create onboarding tables
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_layer INT NOT NULL DEFAULT 1,
  collected_data JSONB NOT NULL DEFAULT '{}',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'checkpoint', 'tool_result')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Indexes
CREATE INDEX IF NOT EXISTS idx_courses_user ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON public.subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_course ON public.topics(course_id);
CREATE INDEX IF NOT EXISTS idx_chapters_topic ON public.chapters(topic_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_course ON public.study_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_session ON public.session_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user ON public.onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON public.onboarding_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_onboarding_messages_session ON public.onboarding_messages(session_id);

-- 14. RLS policies
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_messages ENABLE ROW LEVEL SECURITY;

-- RLS: users can access their own data
CREATE POLICY "Users manage own topic_progress" ON public.topic_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own study_sessions" ON public.study_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own session_messages" ON public.session_messages FOR ALL
  USING (session_id IN (SELECT id FROM public.study_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users manage own exam_formats" ON public.exam_formats FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own exam_dates" ON public.exam_dates FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own study_plan_items" ON public.study_plan_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own onboarding_sessions" ON public.onboarding_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own onboarding_messages" ON public.onboarding_messages FOR ALL
  USING (session_id IN (SELECT id FROM public.onboarding_sessions WHERE user_id = auth.uid()));

-- Chapters: allow access if the course is owned by the user
CREATE POLICY "Users can read chapters of their courses" ON public.chapters FOR SELECT
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Service role manages chapters" ON public.chapters FOR ALL
  USING (true) WITH CHECK (true);
