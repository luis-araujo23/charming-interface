-- Deterministic friendship deletion by relationship id.
-- Prevents false positives when multiple profile rows exist for same auth user.

BEGIN;

CREATE OR REPLACE FUNCTION public.remove_friendship_by_id(
  p_friendship_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_deleted_count integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_friendship_id IS NULL OR p_friendship_id <= 0 THEN
    RAISE EXCEPTION 'Relacion de amistad invalida';
  END IF;

  DELETE FROM public.friendships f
  WHERE f.id = p_friendship_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_id = v_auth_id
        AND u.id IN (f.requester_id, f.addressee_id)
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'No existe relacion de amistad para eliminar o no tienes permisos';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Amigo eliminado correctamente.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friendship_by_id(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_friendship_by_id(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
