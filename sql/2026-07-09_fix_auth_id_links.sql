-- SECURITY FIX: repair corrupted auth_id links in public.users.
--
-- Symptom: a user (e.g. prueba2) logged in on the phone and saw diary notes
-- written by another user (e.g. prueba3) even without being tagged.
--
-- Root cause: the whole app resolves "who am I" with
--     SELECT id FROM public.users WHERE auth_id = auth.uid()
-- which is only safe if auth_id is UNIQUE per row. An older linking flow left
-- some public.users rows pointing at the WRONG Supabase Auth user (another
-- person's auth_id). When that happens the resolver (and any RLS policy keyed
-- on auth_id) matches more than one user, leaking the other person's data.
--
-- This migration re-links every public.users row to the Auth user that shares
-- its email, clears bad/duplicate links, and adds a UNIQUE index so a single
-- Auth user can never again be linked to two different profiles.
--
-- Diagnostic (run first if you want to SEE the corruption):
--   SELECT u.id, u.email, u.auth_id, a.email AS auth_email
--   FROM public.users u
--   LEFT JOIN auth.users a ON a.id = u.auth_id
--   WHERE u.auth_id IS NOT NULL
--     AND lower(coalesce(a.email, '')) <> lower(u.email);

BEGIN;

-- 1) Drop links whose auth_id does NOT belong to the row's own email.
UPDATE public.users u
SET auth_id = NULL
WHERE u.auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users a
    WHERE a.id = u.auth_id
      AND lower(a.email) = lower(u.email)
  );

-- 2) Link each profile to the Auth user that shares its email.
UPDATE public.users u
SET auth_id = a.id
FROM auth.users a
WHERE lower(a.email) = lower(u.email)
  AND u.auth_id IS DISTINCT FROM a.id;

-- 3) If several profiles share the same email (duplicate registrations),
--    keep the link only on the most recent row so auth_id stays unique.
UPDATE public.users u
SET auth_id = NULL
WHERE u.auth_id IS NOT NULL
  AND u.id <> (
    SELECT max(u2.id)
    FROM public.users u2
    WHERE lower(u2.email) = lower(u.email)
  );

-- 4) Enforce a single profile per Auth user from now on. If this fails, run
--    the diagnostic above: there are still duplicate auth_id values to resolve.
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique
  ON public.users (auth_id)
  WHERE auth_id IS NOT NULL;

COMMIT;
