ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS favorite_color text,
  ADD COLUMN IF NOT EXISTS favorite_subject text;