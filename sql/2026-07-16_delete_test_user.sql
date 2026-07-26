-- Borrado DEFINITIVO de una cuenta de prueba.
-- Arregla:
--   1) UI Auth: "Database error deleting user" (FK auth_id)
--   2) SQL: "operator does not exist: character varying = uuid"
--      (auth.refresh_tokens.user_id es texto en algunas versiones)
--
-- Ejecuta TODO en el SQL Editor de Supabase (rol postgres).

BEGIN;

-- 0) Desenlaza auth_id (sin esto Auth UI / DELETE auth.users fallan)
UPDATE public.users
SET auth_id = NULL
WHERE auth_id IN (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
)
OR lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
OR lower(username) = lower('luisaraujo2');

-- 1) Datos de la app ligados al perfil
WITH target AS (
  SELECT id
  FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
)
DELETE FROM public.remembered_entries
WHERE user_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
)
DELETE FROM public.weekly_streaks
WHERE user_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
)
DELETE FROM public.tagged_entry_messages
WHERE author_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
),
entries AS (
  SELECT id FROM public.diary_entries WHERE user_id IN (SELECT id FROM target)
)
DELETE FROM public.entry_photos WHERE entry_id IN (SELECT id FROM entries);

-- entry_tags: tagged_* pueden ser int (users.id) segun tu esquema actual
WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
),
entries AS (
  SELECT id FROM public.diary_entries WHERE user_id IN (SELECT id FROM target)
)
DELETE FROM public.entry_tags
WHERE entry_id IN (SELECT id FROM entries)
   OR tagged_user_id IN (SELECT id FROM target)
   OR tagged_by_user_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
)
DELETE FROM public.friendships
WHERE requester_id IN (SELECT id FROM target)
   OR addressee_id IN (SELECT id FROM target);

WITH target AS (
  SELECT id FROM public.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
     OR lower(username) = lower('luisaraujo2')
)
DELETE FROM public.diary_entries
WHERE user_id IN (SELECT id FROM target);

-- 2) Perfil publico
DELETE FROM public.users
WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
   OR lower(username) = lower('luisaraujo2');

-- 3) Limpieza Auth (casts seguros: refresh_tokens.user_id es varchar)
DO $$
DECLARE
  v_auth_id uuid;
BEGIN
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE NOTICE 'No hay usuario en auth.users para ese correo (ya estaba borrado).';
    RETURN;
  END IF;

  -- Orden seguro + casts
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = v_auth_id::text;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    DELETE FROM auth.sessions WHERE user_id = v_auth_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM auth.mfa_factors WHERE user_id = v_auth_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  BEGIN
    DELETE FROM auth.identities WHERE user_id = v_auth_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  DELETE FROM auth.users WHERE id = v_auth_id;
END $$;

COMMIT;

-- Verificacion (ambas deben dar 0):
SELECT 'public.users' AS origen, count(*)::int AS quedan
FROM public.users
WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com')
   OR lower(username) = lower('luisaraujo2')
UNION ALL
SELECT 'auth.users', count(*)::int
FROM auth.users
WHERE lower(email) = lower('luisalfonsoaraujoleon@gmail.com');
