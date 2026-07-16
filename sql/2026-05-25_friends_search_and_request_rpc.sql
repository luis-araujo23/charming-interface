-- Enable friend search and request flows from mobile app while keeping RLS strict.
-- This migration creates SECURITY DEFINER RPC helpers for authenticated users.

BEGIN;

CREATE OR REPLACE FUNCTION public.search_users_for_friend_request(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id integer,
  username character varying,
  email character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 20));
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.username, u.email
  FROM public.users u
  WHERE u.auth_id IS DISTINCT FROM v_auth_id
    AND u.username ILIKE '%' || v_query || '%'
  ORDER BY
    CASE WHEN lower(u.username) = lower(v_query) THEN 0 ELSE 1 END,
    u.username ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request_by_username(
  p_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_requester_id integer;
  v_addressee_id integer;
  v_existing_status text;
  v_username text := trim(coalesce(p_username, ''));
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_username = '' THEN
    RAISE EXCEPTION 'Debes escribir un username';
  END IF;

  SELECT u.id
    INTO v_requester_id
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  LIMIT 1;

  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  SELECT u.id
    INTO v_addressee_id
  FROM public.users u
  WHERE lower(u.username) = lower(v_username)
  LIMIT 1;

  IF v_addressee_id IS NULL THEN
    RAISE EXCEPTION 'No encontramos un usuario con ese nombre.';
  END IF;

  IF v_addressee_id = v_requester_id THEN
    RAISE EXCEPTION 'No puedes enviarte solicitud a ti mismo.';
  END IF;

  SELECT f.status
    INTO v_existing_status
  FROM public.friendships f
  WHERE f.requester_id IN (v_requester_id, v_addressee_id)
    AND f.addressee_id IN (v_requester_id, v_addressee_id)
  LIMIT 1;

  IF v_existing_status IS NOT NULL THEN
    IF v_existing_status = 'accepted' THEN
      RAISE EXCEPTION 'Ya son amigos.';
    END IF;

    RAISE EXCEPTION 'Ya existe una solicitud pendiente entre ustedes.';
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id, status)
  VALUES (v_requester_id, v_addressee_id, 'pending');

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Solicitud enviada correctamente.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente entre ustedes.';
END;
$$;

REVOKE ALL ON FUNCTION public.search_users_for_friend_request(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_friend_request_by_username(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_users_for_friend_request(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request_by_username(text) TO authenticated;

COMMIT;
