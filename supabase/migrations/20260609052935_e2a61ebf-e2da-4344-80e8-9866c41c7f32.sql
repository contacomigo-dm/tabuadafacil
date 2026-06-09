
CREATE OR REPLACE FUNCTION public.verify_teacher_password(p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_settings
    WHERE id = 1 AND password_hash = crypt(p_password, password_hash)
  );
$$;

CREATE OR REPLACE FUNCTION public.change_teacher_password(p_current text, p_new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE updated_id int;
BEGIN
  UPDATE public.teacher_settings
     SET password_hash = crypt(p_new, gen_salt('bf', 10)),
         updated_at = now()
   WHERE id = 1 AND password_hash = crypt(p_current, password_hash)
   RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bcrypt_hash(p_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT crypt(p_password, gen_salt('bf', 10));
$$;

CREATE OR REPLACE FUNCTION public.verify_bcrypt(p_password text, p_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p_hash = crypt(p_password, p_hash);
$$;

-- Restrict execution to service_role only (edge functions)
REVOKE ALL ON FUNCTION public.verify_teacher_password(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_teacher_password(text) TO service_role;

REVOKE ALL ON FUNCTION public.change_teacher_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_teacher_password(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.bcrypt_hash(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bcrypt_hash(text) TO service_role;

REVOKE ALL ON FUNCTION public.verify_bcrypt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_bcrypt(text, text) TO service_role;
