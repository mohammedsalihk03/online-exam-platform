-- Apply once in Supabase SQL Editor before deploying the updated backend.
-- Existing non-English rows lack a verified source and are regenerated on demand.
ALTER TABLE question_translations ADD COLUMN IF NOT EXISTS source_hash TEXT;
ALTER TABLE option_translations ADD COLUMN IF NOT EXISTS source_hash TEXT;
