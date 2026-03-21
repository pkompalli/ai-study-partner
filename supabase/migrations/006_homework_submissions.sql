-- Homework submissions: persists feedback analysis results
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
  topic_id        UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  chapter_id      UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  topic_name      TEXT,
  chapter_name    TEXT,
  score_estimate  TEXT,
  num_questions   INTEGER NOT NULL DEFAULT 0,
  num_correct     INTEGER NOT NULL DEFAULT 0,
  feedback        JSONB NOT NULL,
  file_names      TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_user_course
  ON public.homework_submissions(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_topic
  ON public.homework_submissions(topic_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_chapter
  ON public.homework_submissions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_created
  ON public.homework_submissions(created_at DESC);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'homework_submissions' AND policyname = 'Users can manage own homework submissions'
  ) THEN
    CREATE POLICY "Users can manage own homework submissions"
      ON public.homework_submissions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
