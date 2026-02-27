-- ====================
-- TOPIC SUMMARY CACHE
-- ====================
CREATE TABLE IF NOT EXISTS public.topic_summaries (
  topic_id      UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL,
  summary       TEXT NOT NULL,
  question      TEXT NOT NULL DEFAULT '',
  answer_pills  JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT -1,
  explanation   TEXT NOT NULL DEFAULT '',
  starters      JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (topic_id, user_id, depth)
);

-- ====================
-- CHAPTER SUMMARY CACHE
-- ====================
CREATE TABLE IF NOT EXISTS public.chapter_summaries (
  chapter_id    UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  depth         INTEGER NOT NULL,
  summary       TEXT NOT NULL,
  question      TEXT NOT NULL DEFAULT '',
  answer_pills  JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT -1,
  explanation   TEXT NOT NULL DEFAULT '',
  starters      JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chapter_id, user_id, depth)
);

-- Indexes for fast user lookups
CREATE INDEX IF NOT EXISTS idx_topic_summaries_user ON public.topic_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_summaries_user ON public.chapter_summaries(user_id);

-- RLS
ALTER TABLE public.topic_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'topic_summaries' AND policyname = 'Users can manage own topic summaries'
  ) THEN
    CREATE POLICY "Users can manage own topic summaries"
      ON public.topic_summaries FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chapter_summaries' AND policyname = 'Users can manage own chapter summaries'
  ) THEN
    CREATE POLICY "Users can manage own chapter summaries"
      ON public.chapter_summaries FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
