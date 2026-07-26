-- Email confirmation for Kitty (web + phone).
--
-- Adds public.users.email_confirmed as the app-level gate (web bcrypt login
-- cannot read auth.users directly). Existing accounts are marked confirmed so
-- nobody already using the app gets locked out. New registrations start as
-- false until the user clicks the Supabase confirmation email.
--
-- Safe to re-run (idempotent).

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_confirmed boolean;

-- Existing rows (already using the app) stay usable.
UPDATE public.users
SET email_confirmed = true
WHERE email_confirmed IS NULL;

ALTER TABLE public.users
  ALTER COLUMN email_confirmed SET DEFAULT false;

ALTER TABLE public.users
  ALTER COLUMN email_confirmed SET NOT NULL;

COMMENT ON COLUMN public.users.email_confirmed IS
  'App-level email verification gate. Synced from auth.users.email_confirmed_at on login when needed.';

COMMIT;
