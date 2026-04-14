-- Fix: allow course deletion by setting onboarding session course_id to NULL
ALTER TABLE onboarding_sessions
  DROP CONSTRAINT IF EXISTS onboarding_sessions_course_id_fkey;

ALTER TABLE onboarding_sessions
  ADD CONSTRAINT onboarding_sessions_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
