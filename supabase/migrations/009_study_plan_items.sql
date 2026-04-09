-- Study plan items: persisted scheduled sessions for the For You page
create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  subject_id text not null,
  topic_id text not null,
  scheduled_date date not null,
  scheduled_time time not null,
  duration_minutes smallint not null default 30,
  status text not null default 'suggested'
    check (status in ('suggested', 'scheduled', 'completed', 'skipped')),
  source text not null default 'auto'
    check (source in ('auto', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_study_plan_user_date on public.study_plan_items(user_id, scheduled_date);
create unique index idx_study_plan_unique_topic_date
  on public.study_plan_items(user_id, topic_id, scheduled_date);

alter table public.study_plan_items enable row level security;

create policy "Users can manage their own study plan items"
  on public.study_plan_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
