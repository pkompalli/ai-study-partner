-- Add chapter coverage to exam dates
-- 'all' stored as empty array; specific chapters stored as UUID array
alter table public.exam_dates
  add column if not exists chapter_ids uuid[] not null default '{}';
