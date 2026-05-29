ALTER TABLE public.students ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS students_username_unique ON public.students (lower(username)) WHERE username IS NOT NULL;

ALTER TABLE public.teacher_settings ADD COLUMN IF NOT EXISTS school_code text NOT NULL DEFAULT '15059260';