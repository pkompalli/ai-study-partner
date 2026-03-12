-- Add subject_id to study_sessions for subject-level sessions
-- Supports 3 navigation levels: Subject (all topics), Topic (specific topic), Chapter (specific chapter)

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Index for looking up active sessions by subject
CREATE INDEX IF NOT EXISTS idx_study_sessions_subject_id
  ON public.study_sessions(subject_id);
