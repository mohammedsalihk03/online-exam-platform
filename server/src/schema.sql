-- PostgreSQL / Supabase Schema for XMWindow Exam Platform

-- 1. Exams Table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  question_count INT NOT NULL DEFAULT 60,
  duration_minutes INT NOT NULL DEFAULT 90,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  default_language TEXT NOT NULL DEFAULT 'English',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published'
  creator_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  public_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_order INT NOT NULL DEFAULT 1,
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Question Translations Table (English, Hindi, Arabic, Malayalam, Urdu)
CREATE TABLE IF NOT EXISTS question_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  source_hash TEXT,
  UNIQUE(question_id, language)
);

-- 4. Question Options Table (A, B, C, D)
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_letter VARCHAR(2) NOT NULL,
  option_text TEXT NOT NULL DEFAULT '',
  image_url TEXT DEFAULT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(question_id, option_letter)
);

-- 5. Option Translations Table (English, Hindi, Arabic, Malayalam, Urdu)
CREATE TABLE IF NOT EXISTS option_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  option_text TEXT NOT NULL DEFAULT '',
  source_hash TEXT,
  UNIQUE(option_id, language)
);

-- Indexes for Token Lookup & Queries
CREATE INDEX IF NOT EXISTS idx_exams_public_token ON exams(public_token);
CREATE INDEX IF NOT EXISTS idx_exams_creator_token ON exams(creator_token);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id, question_order);
CREATE INDEX IF NOT EXISTS idx_option_translations_option_id ON option_translations(option_id);
