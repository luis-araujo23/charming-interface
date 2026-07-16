-- Allow the addressee of a pending friend request to accept or reject it.
-- Works with strict RLS by using SECURITY DEFINER.

BEGIN;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_requester_id integer,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_me integer;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_friendship_id integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Accion invalida';
  END IF;

  IF p_requester_id IS NULL OR p_requester_id <= 0 THEN
    RAISE EXCEPTION 'Solicitante invalido';
  END IF;

  SELECT u.id INTO v_me
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  ORDER BY u.id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  -- Only the addressee can respond, and only while the request is pending.
  SELECT f.id INTO v_friendship_id
  FROM public.friendships f
  WHERE f.requester_id = p_requester_id
    AND f.addressee_id = v_me
    AND f.status = 'pending'
  LIMIT 1;

  IF v_friendship_id IS NULL THEN
    RAISE EXCEPTION 'No hay una solicitud pendiente para responder';
  END IF;

  IF v_action = 'accept' THEN
    UPDATE public.friendships
    SET status = 'accepted',
        updated_at = now()
    WHERE id = v_friendship_id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'accepted',
      'message', 'Solicitud aceptada.'
    );
  ELSE
    DELETE FROM public.friendships
    WHERE id = v_friendship_id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'rejected',
      'message', 'Solicitud rechazada.'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_friend_request(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(integer, text) TO authenticated;

-- Compatibility overload for clients that call RPC with a single JSON argument body.
CREATE OR REPLACE FUNCTION public.respond_friend_request(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id integer;
  v_action text;
BEGIN
  v_requester_id := NULLIF(payload ->> 'p_requester_id', '')::integer;
  v_action := payload ->> 'p_action';
  RETURN public.respond_friend_request(v_requester_id, v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_friend_request(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(jsonb) TO authenticated;

-- Force PostgREST to refresh function signatures immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
