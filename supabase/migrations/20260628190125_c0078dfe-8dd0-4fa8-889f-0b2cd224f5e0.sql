
CREATE TABLE public.weekly_challenge_suspensions (
  turma_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.weekly_challenge_suspensions TO anon, authenticated;
GRANT ALL ON public.weekly_challenge_suspensions TO service_role;
ALTER TABLE public.weekly_challenge_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read suspensions" ON public.weekly_challenge_suspensions FOR SELECT USING (true);
CREATE POLICY "public insert suspensions" ON public.weekly_challenge_suspensions FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete suspensions" ON public.weekly_challenge_suspensions FOR DELETE USING (true);
