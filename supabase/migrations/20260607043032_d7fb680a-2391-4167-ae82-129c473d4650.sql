
CREATE TABLE public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year integer NOT NULL,
  week integer NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 10,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (student_id, year, week)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_challenges TO anon, authenticated;
GRANT ALL ON public.weekly_challenges TO service_role;

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read weekly_challenges" ON public.weekly_challenges FOR SELECT USING (true);
CREATE POLICY "public insert weekly_challenges" ON public.weekly_challenges FOR INSERT WITH CHECK (true);
CREATE POLICY "public update weekly_challenges" ON public.weekly_challenges FOR UPDATE USING (true);
CREATE POLICY "public delete weekly_challenges" ON public.weekly_challenges FOR DELETE USING (true);

CREATE INDEX idx_weekly_challenges_student ON public.weekly_challenges(student_id);
CREATE INDEX idx_weekly_challenges_year_week ON public.weekly_challenges(year, week);
