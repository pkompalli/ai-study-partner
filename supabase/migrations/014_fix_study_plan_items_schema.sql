-- Create study_plan_items table with correct schema matching application code

CREATE TABLE IF NOT EXISTS public.study_plan_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id         UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  chapter_id       UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  scheduled_date   DATE NOT NULL,
  scheduled_time   TEXT DEFAULT '09:00',
  duration_minutes INTEGER DEFAULT 30,
  status           TEXT DEFAULT 'suggested',
  source           TEXT DEFAULT 'auto',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT study_plan_items_status_check CHECK (status IN ('pending', 'suggested', 'scheduled', 'completed', 'skipped')),
  CONSTRAINT study_plan_items_user_topic_date_unique UNIQUE (user_id, topic_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_study_plan_items_user ON public.study_plan_items(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_schedule ON public.study_plan_items(user_id, scheduled_date);

ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own study_plan_items" ON public.study_plan_items FOR ALL USING (user_id = auth.uid());
