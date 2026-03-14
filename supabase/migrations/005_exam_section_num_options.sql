-- Add num_options column to exam_sections for configurable MCQ option count
ALTER TABLE exam_sections ADD COLUMN IF NOT EXISTS num_options integer DEFAULT NULL;
