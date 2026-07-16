-- Return current authenticated user's friendships with requester/addressee profile data.
-- SECURITY DEFINER allows mobile app to read rows even when direct RLS SELECT is restrictive.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_friendships()
RETURNS TABLE (
  id integer,
  requester_id integer,
  addressee_id integer,
  status text,
  requester jsonb,
  addressee jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_me integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT u.id INTO v_me
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.requester_id,
    f.addressee_id,
    f.status::text,
    jsonb_build_object(
      'id', ur.id,
      'username', ur.username,
      'email', ur.email
    ) AS requester,
    jsonb_build_object(
      'id', ua.id,
      'username', ua.username,
      'email', ua.email
    ) AS addressee,
    f.created_at
  FROM public.friendships f
  JOIN public.users ur ON ur.id = f.requester_id
  JOIN public.users ua ON ua.id = f.addressee_id
  WHERE f.requester_id = v_me OR f.addressee_id = v_me
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_friendships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_friendships() TO authenticated;

COMMIT;
