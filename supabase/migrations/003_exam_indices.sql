-- Indices for exam_questions table
-- Speed up lookups by format, topic+depth (for cached question retrieval), and single question fetches

CREATE INDEX IF NOT EXISTS idx_exam_questions_format_id
  ON public.exam_questions(exam_format_id);

CREATE INDEX IF NOT EXISTS idx_exam_questions_topic_depth
  ON public.exam_questions(exam_format_id, topic_id, depth);

CREATE INDEX IF NOT EXISTS idx_exam_questions_course_id
  ON public.exam_questions(course_id);

-- Indices for exam_sections table
CREATE INDEX IF NOT EXISTS idx_exam_sections_format_id
  ON public.exam_sections(exam_format_id);

-- Indices for exam_formats table
CREATE INDEX IF NOT EXISTS idx_exam_formats_user_course
  ON public.exam_formats(user_id, course_id);

-- Indices for exam_attempts table
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_format
  ON public.exam_attempts(user_id, exam_format_id);

-- Indices for exam_attempt_answers table
CREATE INDEX IF NOT EXISTS idx_exam_attempt_answers_attempt_id
  ON public.exam_attempt_answers(attempt_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_answers_question_id
  ON public.exam_attempt_answers(question_id);
