-- Enables the phone app (authenticated Supabase client, subject to RLS) to
-- attach photos and tag friends when creating a diary entry, matching the web
-- app behavior. Uses SECURITY DEFINER RPCs to write to entry_photos/entry_tags
-- without depending on per-table RLS, plus storage policies so authenticated
-- users can upload photos to the diary-photos bucket.

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC: attach friends (by username) to one of MY diary entries.
-- Only accepts usernames that exist AND are accepted friends of the caller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_entry_tags(
  p_entry_id integer,
  p_usernames text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_me integer;
  v_username text;
  v_target_id integer;
  v_tagged text[] := ARRAY[]::text[];
  v_invalid text[] := ARRAY[]::text[];
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT u.id INTO v_me
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  ORDER BY u.id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  -- The entry must exist and belong to the caller.
  PERFORM 1 FROM public.diary_entries e
  WHERE e.id = p_entry_id AND e.user_id = v_me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permisos sobre esta entrada';
  END IF;

  IF p_usernames IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'tagged', to_jsonb(v_tagged), 'invalid', to_jsonb(v_invalid));
  END IF;

  FOREACH v_username IN ARRAY p_usernames LOOP
    v_username := lower(trim(v_username));
    CONTINUE WHEN v_username = '';

    SELECT u.id INTO v_target_id
    FROM public.users u
    WHERE lower(u.username) = v_username
    LIMIT 1;

    IF v_target_id IS NULL OR v_target_id = v_me THEN
      v_invalid := array_append(v_invalid, v_username);
      CONTINUE;
    END IF;

    -- Must be an accepted friend in either direction.
    PERFORM 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = v_me AND f.addressee_id = v_target_id)
        OR (f.requester_id = v_target_id AND f.addressee_id = v_me))
    LIMIT 1;

    IF NOT FOUND THEN
      v_invalid := array_append(v_invalid, v_username);
      CONTINUE;
    END IF;

    INSERT INTO public.entry_tags (entry_id, tagged_user_id, tagged_by_user_id)
    VALUES (p_entry_id, v_target_id, v_me)
    ON CONFLICT (entry_id, tagged_user_id) DO NOTHING;

    v_tagged := array_append(v_tagged, v_username);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'tagged', to_jsonb(v_tagged),
    'invalid', to_jsonb(v_invalid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.attach_entry_tags(integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_entry_tags(integer, text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: register a photo URL for one of MY diary entries.
-- The binary upload happens client-side via Supabase Storage; this only
-- records the resulting public URL after verifying ownership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_entry_photo(
  p_entry_id integer,
  p_photo_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_me integer;
  v_photo_id integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_photo_url IS NULL OR trim(p_photo_url) = '' THEN
    RAISE EXCEPTION 'URL de foto invalida';
  END IF;

  SELECT u.id INTO v_me
  FROM public.users u
  WHERE u.auth_id = v_auth_id
  ORDER BY u.id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  PERFORM 1 FROM public.diary_entries e
  WHERE e.id = p_entry_id AND e.user_id = v_me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes permisos sobre esta entrada';
  END IF;

  INSERT INTO public.entry_photos (entry_id, photo_url)
  VALUES (p_entry_id, trim(p_photo_url))
  RETURNING id INTO v_photo_id;

  RETURN jsonb_build_object('ok', true, 'id', v_photo_id, 'photo_url', trim(p_photo_url));
END;
$$;

REVOKE ALL ON FUNCTION public.attach_entry_photo(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_entry_photo(integer, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: make sure the diary-photos bucket exists and is publicly readable,
-- and allow authenticated users to upload/manage objects inside it.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('diary-photos', 'diary-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "diary-photos public read" ON storage.objects;
CREATE POLICY "diary-photos public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'diary-photos');

DROP POLICY IF EXISTS "diary-photos authenticated insert" ON storage.objects;
CREATE POLICY "diary-photos authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'diary-photos');

DROP POLICY IF EXISTS "diary-photos authenticated update" ON storage.objects;
CREATE POLICY "diary-photos authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'diary-photos')
  WITH CHECK (bucket_id = 'diary-photos');

-- ---------------------------------------------------------------------------
-- Read policies so the authenticated phone client can load the photos and
-- tags of entries it owns (or entries where it was tagged). The web app uses
-- the service_role key and bypasses RLS, so these policies don't affect it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.entry_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entry_photos readable by owner or tagged" ON public.entry_photos;
CREATE POLICY "entry_photos readable by owner or tagged"
  ON public.entry_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.diary_entries e
      JOIN public.users u ON u.id = e.user_id
      WHERE e.id = entry_photos.entry_id
        AND u.auth_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.entry_tags t
      JOIN public.users u ON u.id = t.tagged_user_id
      WHERE t.entry_id = entry_photos.entry_id
        AND u.auth_id = auth.uid()
    )
  );

ALTER TABLE public.entry_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entry_tags readable by owner or tagged" ON public.entry_tags;
CREATE POLICY "entry_tags readable by owner or tagged"
  ON public.entry_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.diary_entries e
      JOIN public.users u ON u.id = e.user_id
      WHERE e.id = entry_tags.entry_id
        AND u.auth_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = entry_tags.tagged_user_id
        AND u.auth_id = auth.uid()
    )
  );

-- Force PostgREST to refresh function signatures immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
