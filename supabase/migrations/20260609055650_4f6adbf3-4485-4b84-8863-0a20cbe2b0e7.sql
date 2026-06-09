
-- Restore SELECT access for the app to read student rosters/ranking/history.
-- Sensitive columns (password_hash, birth_year, favorite_color, favorite_subject)
-- stay server-only.

CREATE POLICY "public read students safe"
  ON public.students FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT
  (id, first_name, username, current_level, best_streak, current_streak,
   total_correct, total_wrong, grade, class_name, shift, created_at, updated_at)
  ON public.students TO anon, authenticated;
