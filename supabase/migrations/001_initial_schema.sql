-- ====================
-- 1. PROFILES
-- ====================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  year_of_study TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 2. COURSES
-- ====================
CREATE TABLE public.courses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  goal            TEXT NOT NULL CHECK (goal IN ('exam_prep', 'classwork')),
  exam_name       TEXT,
  year_of_study   TEXT,
  source_type     TEXT CHECK (source_type IN ('text', 'pdf', 'image', 'json')),
  source_file_url TEXT,
  raw_input       TEXT,
  structure       JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 3. SUBJECTS
-- ====================
CREATE TABLE public.subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 4. TOPICS
-- ====================
CREATE TABLE public.topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 5. CHAPTERS
-- ====================
CREATE TABLE public.chapters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 6. TOPIC PROGRESS
-- ====================
CREATE TABLE public.topic_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id       UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  sessions_count INTEGER DEFAULT 0,
  last_studied   TIMESTAMPTZ,
  UNIQUE(user_id, topic_id)
);

-- ====================
-- 7. STUDY SESSIONS
-- ====================
CREATE TABLE public.study_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id   UUID REFERENCES public.topics(id),
  chapter_id UUID REFERENCES public.chapters(id),
  title      TEXT,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at   TIMESTAMPTZ,
  metadata   JSONB DEFAULT '{}'
);

-- ====================
-- 8. SESSION MESSAGES
-- ====================
CREATE TABLE public.session_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'quiz', 'flashcards', 'videos')),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 9. QUIZZES
-- ====================
CREATE TABLE public.quizzes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id     UUID REFERENCES public.topics(id),
  questions    JSONB NOT NULL,
  answers      JSONB DEFAULT '{}',
  score        INTEGER,
  total        INTEGER,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 10. FLASHCARD SETS
-- ====================
CREATE TABLE public.flashcard_sets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id   UUID REFERENCES public.topics(id),
  cards      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- 11. LESSON ARTIFACTS
-- ====================
CREATE TABLE public.lesson_artifacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  topic_id         UUID REFERENCES public.topics(id),
  title            TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  pdf_url          TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- INDEXES
-- ====================
CREATE INDEX idx_courses_user_id ON public.courses(user_id);
CREATE INDEX idx_subjects_course_id ON public.subjects(course_id);
CREATE INDEX idx_topics_subject_id ON public.topics(subject_id);
CREATE INDEX idx_topics_course_id ON public.topics(course_id);
CREATE INDEX idx_chapters_topic_id ON public.chapters(topic_id);
CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_course_id ON public.study_sessions(course_id);
CREATE INDEX idx_session_messages_session_id ON public.session_messages(session_id);
CREATE INDEX idx_quizzes_session_id ON public.quizzes(session_id);
CREATE INDEX idx_flashcard_sets_session_id ON public.flashcard_sets(session_id);
CREATE INDEX idx_lesson_artifacts_session_id ON public.lesson_artifacts(session_id);
CREATE INDEX idx_lesson_artifacts_user_id ON public.lesson_artifacts(user_id);
CREATE INDEX idx_topic_progress_user_id ON public.topic_progress(user_id);

-- ====================
-- RLS POLICIES
-- ====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_artifacts ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses
CREATE POLICY "Users can manage own courses" ON public.courses FOR ALL USING (auth.uid() = user_id);

-- Subjects (via course ownership)
CREATE POLICY "Users can view subjects of own courses" ON public.subjects FOR SELECT
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert subjects to own courses" ON public.subjects FOR INSERT
  WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete subjects of own courses" ON public.subjects FOR DELETE
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));

-- Topics
CREATE POLICY "Users can view topics of own courses" ON public.topics FOR SELECT
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert topics to own courses" ON public.topics FOR INSERT
  WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete topics of own courses" ON public.topics FOR DELETE
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));

-- Chapters
CREATE POLICY "Users can view chapters of own courses" ON public.chapters FOR SELECT
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert chapters to own courses" ON public.chapters FOR INSERT
  WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete chapters of own courses" ON public.chapters FOR DELETE
  USING (course_id IN (SELECT id FROM public.courses WHERE user_id = auth.uid()));

-- Topic Progress
CREATE POLICY "Users can manage own topic progress" ON public.topic_progress FOR ALL USING (auth.uid() = user_id);

-- Study Sessions
CREATE POLICY "Users can manage own sessions" ON public.study_sessions FOR ALL USING (auth.uid() = user_id);

-- Session Messages (via session ownership)
CREATE POLICY "Users can view messages of own sessions" ON public.session_messages FOR SELECT
  USING (session_id IN (SELECT id FROM public.study_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert messages to own sessions" ON public.session_messages FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM public.study_sessions WHERE user_id = auth.uid()));

-- Quizzes
CREATE POLICY "Users can manage own quizzes" ON public.quizzes FOR ALL USING (auth.uid() = user_id);

-- Flashcard Sets
CREATE POLICY "Users can manage own flashcard sets" ON public.flashcard_sets FOR ALL USING (auth.uid() = user_id);

-- Lesson Artifacts
CREATE POLICY "Users can manage own artifacts" ON public.lesson_artifacts FOR ALL USING (auth.uid() = user_id);

-- ====================
-- TRIGGER: auto-create profile on sign up
-- ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ====================
-- STORAGE BUCKETS
-- (Run these manually in Supabase Dashboard > Storage or via CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-uploads', 'course-uploads', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-artifacts', 'lesson-artifacts', false);
-- ====================
