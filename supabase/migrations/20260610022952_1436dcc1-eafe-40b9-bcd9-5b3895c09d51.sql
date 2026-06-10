ALTER TABLE public.students ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'floresta';
GRANT SELECT (theme), UPDATE (theme) ON public.students TO anon, authenticated;