-- "Recuerdos" (memories) for the phone app (authenticated client, RLS).
-- The web app manages this via service_role in /api/memories; the phone needs
-- SECURITY DEFINER RPCs so it can read/write remembered_entries without hitting
-- RLS dead-ends. A memory is a text fragment the user chose to keep from one of
-- their OWN diary entries.
--
-- 1) get_my_memories()               -> my saved memories + their entry data.
-- 2) add_memory(entry_id, text)      -> save a fragment from an entry I OWN.
-- 3) delete_memory(memory_id)        -> remove one of MY memories.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_memories()
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

  SELECT coalesce(jsonb_agg(item ORDER BY sort_memory_date DESC, sort_created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      r.memory_date AS sort_memory_date,
      r.created_at  AS sort_created_at,
      jsonb_build_object(
        'id', r.id,
        'entryId', e.id,
        'entryTitle', e.title,
        'entryDate', e.entry_date,
        'memoryDate', r.memory_date,
        'selectedText', coalesce(nullif(trim(r.selected_text), ''), e.content),
        'createdAt', r.created_at
      ) AS item
    FROM public.remembered_entries r
    JOIN public.diary_entries e ON e.id = r.entry_id
    WHERE r.user_id = v_me
      AND e.user_id = v_me
  ) sub;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_memories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_memories() TO authenticated;


CREATE OR REPLACE FUNCTION public.add_memory(
  p_entry_id integer,
  p_selected_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_me integer;
  v_text text := trim(coalesce(p_selected_text, ''));
  v_entry_date date;
  v_entry_title text;
  v_entry_content text;
  v_id integer;
  v_created timestamptz;
  v_memory_date date;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_text = '' THEN
    RAISE EXCEPTION 'Selecciona un texto para guardar en recuerdos';
  END IF;

  IF length(v_text) > 2000 THEN
    RAISE EXCEPTION 'El texto seleccionado es demasiado largo (maximo 2000 caracteres)';
  END IF;

  SELECT id INTO v_me
  FROM public.users
  WHERE auth_id = v_auth
  ORDER BY id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  -- The entry must exist and belong to the caller.
  SELECT e.entry_date, e.title, e.content
    INTO v_entry_date, v_entry_title, v_entry_content
  FROM public.diary_entries e
  WHERE e.id = p_entry_id AND e.user_id = v_me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa entrada en tu diario';
  END IF;

  v_memory_date := coalesce(v_entry_date, current_date);

  -- Un recuerdo por entrada, EDITABLE. Si ya existe un recuerdo para esta
  -- entrada (sin importar con que memory_date se creo, p. ej. desde la web),
  -- actualizamos su fragmento; si no existe, lo insertamos. Esto garantiza que
  -- "editar" un recuerdo existente realmente cambie el texto (antes dependia de
  -- que memory_date coincidiera y por eso a veces se quedaba el texto anterior).
  UPDATE public.remembered_entries
     SET selected_text = v_text
   WHERE id = (
     SELECT id
     FROM public.remembered_entries
     WHERE user_id = v_me AND entry_id = p_entry_id
     ORDER BY memory_date DESC, id DESC
     LIMIT 1
   )
   RETURNING id, created_at, memory_date INTO v_id, v_created, v_memory_date;

  IF v_id IS NULL THEN
    INSERT INTO public.remembered_entries (user_id, entry_id, memory_date, selected_text)
    VALUES (v_me, p_entry_id, v_memory_date, v_text)
    RETURNING id, created_at INTO v_id, v_created;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'entryId', p_entry_id,
    'entryTitle', v_entry_title,
    'entryDate', v_entry_date,
    'memoryDate', v_memory_date,
    'selectedText', v_text,
    'createdAt', v_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_memory(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_memory(integer, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_memory(
  p_memory_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_me integer;
  v_deleted integer;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id INTO v_me
  FROM public.users
  WHERE auth_id = v_auth
  ORDER BY id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu perfil publico';
  END IF;

  DELETE FROM public.remembered_entries
  WHERE id = p_memory_id AND user_id = v_me;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('ok', v_deleted > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_memory(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_memory(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
