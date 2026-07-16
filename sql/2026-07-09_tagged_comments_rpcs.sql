-- Comments on tagged notes for the phone app (authenticated client, RLS).
-- The web app already supports this via service_role; the phone needs
-- SECURITY DEFINER RPCs to read/write across users, entry_tags,
-- tagged_entry_messages and diary_entries without hitting RLS dead-ends.
--
-- 1) get_tagged_notes()          -> notes where I am the tagged user, with the
--                                   entry data, photos and comments.
-- 2) add_tagged_comment(...)     -> add a comment to a tag I'm part of
--                                   (either the tagged user or the tagger).
-- 3) get_entry_comments(ids[])   -> comments on entries I OWN, so the note
--                                   author can read replies in their diary.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tagged_notes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_me integer;
  v_result jsonb;
BEGIN
  IF v_auth IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_me
  FROM public.users
  WHERE auth_id = v_auth
  ORDER BY id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(note ORDER BY tagged_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      t.created_at AS tagged_at,
      jsonb_build_object(
        'entryTagId', t.id,
        'entryId', e.id,
        'title', e.title,
        'content', e.content,
        'entryDate', e.entry_date,
        'songTitle', e.song_title,
        'songArtist', e.song_artist,
        'songUrl', e.song_url,
        'taggedByUsername', tb.username,
        'taggedAt', t.created_at,
        'photoUrls', coalesce((
          SELECT jsonb_agg(p.photo_url ORDER BY p.created_at ASC)
          FROM public.entry_photos p
          WHERE p.entry_id = e.id
        ), '[]'::jsonb),
        'comments', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id,
            'authorId', m.author_id,
            'authorUsername', au.username,
            'message', m.message,
            'createdAt', m.created_at
          ) ORDER BY m.created_at ASC)
          FROM public.tagged_entry_messages m
          JOIN public.users au ON au.id = m.author_id
          WHERE m.entry_tag_id = t.id
        ), '[]'::jsonb)
      ) AS note
    FROM public.entry_tags t
    JOIN public.diary_entries e ON e.id = t.entry_id
    JOIN public.users tb ON tb.id = t.tagged_by_user_id
    WHERE t.tagged_user_id = v_me
  ) sub;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tagged_notes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tagged_notes() TO authenticated;


CREATE OR REPLACE FUNCTION public.add_tagged_comment(
  p_entry_tag_id integer,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_me integer;
  v_msg text := trim(coalesce(p_message, ''));
  v_allowed boolean;
  v_id integer;
  v_created timestamptz;
  v_username text;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_msg = '' THEN
    RAISE EXCEPTION 'El mensaje no puede estar vacio';
  END IF;

  IF length(v_msg) > 1200 THEN
    RAISE EXCEPTION 'El mensaje puede tener maximo 1200 caracteres';
  END IF;

  SELECT id, username INTO v_me, v_username
  FROM public.users
  WHERE auth_id = v_auth
  ORDER BY id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.entry_tags t
    WHERE t.id = p_entry_tag_id
      AND (t.tagged_user_id = v_me OR t.tagged_by_user_id = v_me)
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'No tienes permisos para comentar esta etiqueta';
  END IF;

  INSERT INTO public.tagged_entry_messages (entry_tag_id, author_id, message)
  VALUES (p_entry_tag_id, v_me, v_msg)
  RETURNING id, created_at INTO v_id, v_created;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'authorUsername', v_username,
    'message', v_msg,
    'createdAt', v_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_tagged_comment(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_tagged_comment(integer, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_entry_comments(p_entry_ids integer[])
RETURNS TABLE(
  entry_id integer,
  comment_id integer,
  author_username text,
  tagged_user_username text,
  message text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS entry_id,
    m.id AS comment_id,
    au.username AS author_username,
    tu.username AS tagged_user_username,
    m.message,
    m.created_at
  FROM public.diary_entries e
  JOIN public.users me ON me.id = e.user_id
  JOIN public.entry_tags t ON t.entry_id = e.id
  JOIN public.tagged_entry_messages m ON m.entry_tag_id = t.id
  JOIN public.users au ON au.id = m.author_id
  JOIN public.users tu ON tu.id = t.tagged_user_id
  WHERE e.id = ANY(p_entry_ids)
    AND me.auth_id = auth.uid()
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_entry_comments(integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entry_comments(integer[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
