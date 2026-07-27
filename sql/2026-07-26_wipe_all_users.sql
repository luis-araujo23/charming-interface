-- =============================================================================
-- WIPE TOTAL (resistente): deja la base en 0.
-- Si una tabla no existe, sigue. Ejecuta TODO en Supabase → SQL Editor.
-- IRREVERSIBLE.
-- =============================================================================

-- 0) Ver qué hay AHORA (mira el resultado antes de borrar)
SELECT 'public.users' AS tabla, count(*)::int AS n FROM public.users
UNION ALL SELECT 'auth.users', count(*)::int FROM auth.users;

SELECT id, username, email, auth_id
FROM public.users
ORDER BY id
LIMIT 50;

-- 1) Borrado
BEGIN;

UPDATE public.users SET auth_id = NULL WHERE auth_id IS NOT NULL;

DO $$
BEGIN
  -- Hijos primero
  BEGIN DELETE FROM public.tagged_entry_messages; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.entry_photos; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.entry_tags; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.remembered_entries; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.weekly_streaks; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.friendships; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM public.diary_entries; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- Perfiles
  DELETE FROM public.users;

  -- Auth
  BEGIN DELETE FROM auth.refresh_tokens; EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM auth.sessions; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.mfa_factors; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.identities; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM auth.one_time_tokens; EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM auth.users;
END $$;

COMMIT;

-- 2) Debe quedar todo en 0
SELECT 'public.users' AS tabla, count(*)::int AS quedan FROM public.users
UNION ALL SELECT 'auth.users', count(*)::int FROM auth.users
UNION ALL SELECT 'diary_entries', count(*)::int FROM public.diary_entries;
