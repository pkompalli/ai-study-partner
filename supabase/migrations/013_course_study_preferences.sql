-- Add study preferences JSONB column to courses table
-- Stores: sessions_per_week, minutes_per_session, preferred_times, preferred_days
alter table public.courses
  add column if not exists study_preferences jsonb default null;
