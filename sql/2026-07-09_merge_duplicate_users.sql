-- DATA-INTEGRITY FIX: merge duplicate public.users rows (one profile per email).
--
-- Symptom (round 2): after the previous auth_id repair, prueba2 was correct
-- (only tagged notes, never wrote), but prueba3 -- who DID write notes -- saw an
-- empty diary.
--
-- Root cause: some people have MORE THAN ONE row in public.users for the same
-- email (duplicate registrations). Their data got split across those rows:
--   * The web app writes diary_entries using the id it resolved at login
--     (SELECT ... FROM users WHERE email ILIKE ? LIMIT 1  -> arbitrary row).
--   * The phone resolves "who am I" with WHERE auth_id = auth.uid() (and the
--     RPCs use ORDER BY id DESC LIMIT 1 -> the NEWEST row).
-- When those two rows differ, the notes live under one profile while the login
-- points at the other, so the diary looks empty. The earlier "keep the newest
-- link" step made this worse for prueba3.
--
-- This migration consolidates every duplicate group into a single canonical
-- profile (the OLDEST id), repoints ALL foreign keys to it, deletes the extra
-- rows, re-links auth_id by email, and adds UNIQUE indexes so duplicates can
-- never be created again. It supersedes 2026-07-09_fix_auth_id_links.sql.
--
-- Diagnostic (run first to SEE the duplicates):
--   SELECT lower(email) AS email, count(*) AS profiles,
--          array_agg(id ORDER BY id) AS ids
--   FROM public.users
--   GROUP BY lower(email)
--   HAVING count(*) > 1;

BEGIN;

DO $$
DECLARE
  g RECORD;
  d RECORD;
  v_canonical integer;
BEGIN
  FOR g IN
    SELECT lower(email) AS email_key
    FROM public.users
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
  LOOP
    -- Canonical profile = the oldest row for this email.
    SELECT id INTO v_canonical
    FROM public.users
    WHERE lower(email) = g.email_key
    ORDER BY id ASC
    LIMIT 1;

    FOR d IN
      SELECT id
      FROM public.users
      WHERE lower(email) = g.email_key
        AND id <> v_canonical
    LOOP
      ------------------------------------------------------------------
      -- diary entries
      ------------------------------------------------------------------
      UPDATE public.diary_entries SET user_id = v_canonical WHERE user_id = d.id;

      ------------------------------------------------------------------
      -- remembered entries (drop true duplicates before repointing)
      ------------------------------------------------------------------
      DELETE FROM public.remembered_entries r
      WHERE r.user_id = d.id
        AND EXISTS (
          SELECT 1 FROM public.remembered_entries c
          WHERE c.user_id = v_canonical AND c.entry_id = r.entry_id
        );
      UPDATE public.remembered_entries SET user_id = v_canonical WHERE user_id = d.id;

      ------------------------------------------------------------------
      -- weekly streaks are derived data; drop the duplicate's rows to
      -- avoid unique(user_id, week_start_date) clashes. They get
      -- recomputed automatically the next time /api/streaks runs.
      ------------------------------------------------------------------
      DELETE FROM public.weekly_streaks WHERE user_id = d.id;

      ------------------------------------------------------------------
      -- comments authored by the duplicate
      ------------------------------------------------------------------
      UPDATE public.tagged_entry_messages SET author_id = v_canonical WHERE author_id = d.id;

      ------------------------------------------------------------------
      -- entry_tags where the duplicate is the TAGGED user. Respect the
      -- unique(entry_id, tagged_user_id): move any comments off the
      -- losing tag row, delete it, then repoint the survivors.
      ------------------------------------------------------------------
      UPDATE public.tagged_entry_messages m
      SET entry_tag_id = c.id
      FROM public.entry_tags t
      JOIN public.entry_tags c
        ON c.entry_id = t.entry_id AND c.tagged_user_id = v_canonical
      WHERE m.entry_tag_id = t.id
        AND t.tagged_user_id = d.id;

      DELETE FROM public.entry_tags t
      WHERE t.tagged_user_id = d.id
        AND EXISTS (
          SELECT 1 FROM public.entry_tags c
          WHERE c.entry_id = t.entry_id AND c.tagged_user_id = v_canonical
        );

      UPDATE public.entry_tags SET tagged_user_id = v_canonical WHERE tagged_user_id = d.id;
      UPDATE public.entry_tags SET tagged_by_user_id = v_canonical WHERE tagged_by_user_id = d.id;

      ------------------------------------------------------------------
      -- friendships. Remove edges that would collide once repointed
      -- (canonical already friends with the same person, or a direct
      -- duplicate<->canonical edge), then repoint the rest.
      ------------------------------------------------------------------
      DELETE FROM public.friendships f
      WHERE (f.requester_id = d.id OR f.addressee_id = d.id)
        AND EXISTS (
          SELECT 1 FROM public.friendships c
          WHERE (c.requester_id = v_canonical OR c.addressee_id = v_canonical)
            AND (
              (CASE WHEN f.requester_id = d.id THEN f.addressee_id ELSE f.requester_id END)
              =
              (CASE WHEN c.requester_id = v_canonical THEN c.addressee_id ELSE c.requester_id END)
            )
        );

      DELETE FROM public.friendships f
      WHERE (f.requester_id = d.id AND f.addressee_id = v_canonical)
         OR (f.requester_id = v_canonical AND f.addressee_id = d.id);

      UPDATE public.friendships SET requester_id = v_canonical WHERE requester_id = d.id;
      UPDATE public.friendships SET addressee_id = v_canonical WHERE addressee_id = d.id;

      ------------------------------------------------------------------
      -- The duplicate profile has no remaining references: delete it.
      ------------------------------------------------------------------
      DELETE FROM public.users WHERE id = d.id;
    END LOOP;
  END LOOP;

  -- Safety net: drop any self-referential or duplicate friendship pairs.
  DELETE FROM public.friendships WHERE requester_id = addressee_id;

  DELETE FROM public.friendships f
  USING public.friendships g2
  WHERE f.id > g2.id
    AND LEAST(f.requester_id, f.addressee_id) = LEAST(g2.requester_id, g2.addressee_id)
    AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(g2.requester_id, g2.addressee_id);
END $$;

-- Re-link every remaining profile to the Auth user that shares its email,
-- clearing any link that points at the wrong Auth user.
UPDATE public.users u
SET auth_id = NULL
WHERE u.auth_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users a
    WHERE a.id = u.auth_id AND lower(a.email) = lower(u.email)
  );

UPDATE public.users u
SET auth_id = a.id
FROM auth.users a
WHERE lower(a.email) = lower(u.email)
  AND u.auth_id IS DISTINCT FROM a.id;

-- Enforce a single profile per email and per Auth user from now on so this can
-- never happen again. Registrations with a duplicate email now fail cleanly
-- (handled as 23505 in /api/auth/register).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON public.users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique
  ON public.users (auth_id)
  WHERE auth_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
