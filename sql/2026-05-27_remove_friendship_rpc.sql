-- Remove friendship/request relation between authenticated user and another user.
-- Works with strict RLS by using SECURITY DEFINER.

BEGIN;

CREATE OR REPLACE FUNCTION public.remove_friendship_with_user(
  p_other_user_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_me integer;
  v_deleted_count integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id <= 0 THEN
    RAISE EXCEPTION 'Usuario destino invalido';
  END IF;

  SELECT u.id INTO v_me
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  ORDER BY u.id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  DELETE FROM public.friendships f
  WHERE f.requester_id IN (v_me, p_other_user_id)
    AND f.addressee_id IN (v_me, p_other_user_id);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'No existe relacion de amistad para eliminar';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Amigo eliminado correctamente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friendship_with_user(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship_with_user(integer) TO authenticated;

-- Compatibility overload for clients that call RPC with a single JSON argument body.
CREATE OR REPLACE FUNCTION public.remove_friendship_with_user(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other_user_id integer;
BEGIN
  v_other_user_id := NULLIF(payload ->> 'p_other_user_id', '')::integer;
  RETURN public.remove_friendship_with_user(v_other_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friendship_with_user(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship_with_user(jsonb) TO authenticated;

-- Force PostgREST to refresh function signatures immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
