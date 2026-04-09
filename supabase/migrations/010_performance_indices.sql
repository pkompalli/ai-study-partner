-- Performance indices for common query patterns

-- Session messages: frequently fetched by session_id ordered by created_at
create index if not exists idx_session_messages_session_created
  on public.session_messages(session_id, created_at asc);

-- Study sessions: fetched by user ordered by started_at (For You page, dashboard)
create index if not exists idx_study_sessions_user_started
  on public.study_sessions(user_id, started_at desc);

-- Study sessions: fetched by course+user ordered by started_at
create index if not exists idx_study_sessions_course_user_started
  on public.study_sessions(course_id, user_id, started_at desc);

-- Study sessions: active session lookups
create index if not exists idx_study_sessions_user_status
  on public.study_sessions(user_id, status);

-- Topic cards: fetched by user+topic (session topic bank)
create index if not exists idx_topic_cards_user_topic
  on public.topic_cards(user_id, topic_id);

-- Topic check questions: fetched by user+topic
create index if not exists idx_topic_check_questions_user_topic
  on public.topic_check_questions(user_id, topic_id);

-- Exam dates: fetched by user+course ordered by date
create index if not exists idx_exam_dates_user_course_date
  on public.exam_dates(user_id, course_id, exam_date asc);
