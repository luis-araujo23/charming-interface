-- Fix: al editar el recuerdo de una entrada que YA tenia recuerdo, el texto no
-- se actualizaba (se quedaba el fragmento anterior).
--
-- Causa: la version anterior de add_memory dependia de un upsert por
-- (user_id, entry_id, memory_date). Si la fila existente tenia otro memory_date
-- (o la funcion desplegada no era la version con ON CONFLICT DO UPDATE), la
-- actualizacion no se aplicaba.
--
-- Solucion: "un recuerdo por entrada, editable". Si ya existe un recuerdo para
-- la entrada, se actualiza su fragmento; si no, se inserta.
--
-- Es idempotente y seguro (CREATE OR REPLACE). Ejecuta todo el archivo en el
-- editor SQL de Supabase.

BEGIN;

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

  -- La entrada debe existir y ser del usuario.
  SELECT e.entry_date, e.title
    INTO v_entry_date, v_entry_title
  FROM public.diary_entries e
  WHERE e.id = p_entry_id AND e.user_id = v_me;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos esa entrada en tu diario';
  END IF;

  v_memory_date := coalesce(v_entry_date, current_date);

  -- Actualiza el recuerdo existente de esta entrada (el mas reciente si por
  -- alguna razon hubiera mas de uno); si no hay ninguno, lo inserta.
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

NOTIFY pgrst, 'reload schema';

COMMIT;
