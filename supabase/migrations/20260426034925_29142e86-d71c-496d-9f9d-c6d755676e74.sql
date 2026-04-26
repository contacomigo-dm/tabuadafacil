ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS class_name text,
  ADD COLUMN IF NOT EXISTS shift text;

CREATE POLICY "public delete students" ON public.students FOR DELETE USING (true);
CREATE POLICY "public delete attempts" ON public.attempts FOR DELETE USING (true);
CREATE POLICY "public delete sessions" ON public.sessions FOR DELETE USING (true);