-- Exam dates: per-course exam/deadline tracking
create table if not exists public.exam_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  label text not null,            -- e.g. "Midterm", "Final", "Assignment 2"
  exam_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_exam_dates_user on public.exam_dates(user_id);
create index idx_exam_dates_course on public.exam_dates(course_id);

alter table public.exam_dates enable row level security;

create policy "Users can manage their own exam dates"
  on public.exam_dates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
