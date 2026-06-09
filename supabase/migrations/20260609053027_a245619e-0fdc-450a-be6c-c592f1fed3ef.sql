
GRANT SELECT (
  id, first_name, username, current_level,
  best_streak, current_streak, total_correct, total_wrong,
  grade, class_name, shift, created_at, updated_at
) ON public.students TO anon, authenticated;
