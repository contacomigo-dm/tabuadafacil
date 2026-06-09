
-- Enable pgcrypto for bcrypt (crypt/gen_salt) in case it's not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- teacher_settings hardening
-- =========================
ALTER TABLE public.teacher_settings
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Seed bcrypt hash from current plaintext password if hash is null.
-- If no password is set, seed with default 'trocar123' so the professor can log in once and reset.
UPDATE public.teacher_settings
   SET password_hash = crypt(COALESCE(NULLIF(password, ''), 'trocar123'), gen_salt('bf', 10))
 WHERE password_hash IS NULL;

ALTER TABLE public.teacher_settings ALTER COLUMN password_hash SET NOT NULL;

-- Drop the plaintext password column entirely
ALTER TABLE public.teacher_settings DROP COLUMN IF EXISTS password;

-- Lock down access: only service_role (edge functions) can touch it
DROP POLICY IF EXISTS "public read teacher_settings" ON public.teacher_settings;
DROP POLICY IF EXISTS "public update teacher_settings" ON public.teacher_settings;

REVOKE ALL ON public.teacher_settings FROM anon;
REVOKE ALL ON public.teacher_settings FROM authenticated;
GRANT ALL ON public.teacher_settings TO service_role;

-- Allow the app to still read the school_code publicly (it's not sensitive)
-- via a tiny view.
CREATE OR REPLACE VIEW public.school_info
WITH (security_invoker = on) AS
  SELECT school_code FROM public.teacher_settings WHERE id = 1;
GRANT SELECT ON public.school_info TO anon, authenticated;

-- =========================
-- students hardening
-- =========================
-- Public-safe view: excludes password_hash and security-answer fields
CREATE OR REPLACE VIEW public.students_public
WITH (security_invoker = on) AS
  SELECT
    id, first_name, username, current_level,
    best_streak, current_streak, total_correct, total_wrong,
    grade, class_name, shift, created_at, updated_at
  FROM public.students;

GRANT SELECT ON public.students_public TO anon, authenticated;

-- Remove broad SELECT on the base students table.
-- INSERT/UPDATE/DELETE policies stay (game-state writes happen from client today);
-- writes of sensitive columns (password_hash, birth_year, favorite_*) are still
-- possible from client but the hash itself is no longer readable. Login,
-- registration, and password reset move to the student-auth edge function.
DROP POLICY IF EXISTS "public read students" ON public.students;

-- Service role keeps full access for edge functions
GRANT ALL ON public.students TO service_role;
-- Keep INSERT/UPDATE/DELETE grants for anon for now (covered by existing policies)
GRANT INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
-- Explicitly REMOVE SELECT for anon/authenticated; only the view is readable
REVOKE SELECT ON public.students FROM anon;
REVOKE SELECT ON public.students FROM authenticated;
