-- Lets the phone app read WHO was tagged in a set of diary entries, returning
-- the tagged usernames. Direct reads of public.users for other people are
-- blocked by RLS (each user can only see their own row), so a plain join from
-- entry_tags to users returns empty usernames for the author. This
-- SECURITY DEFINER function bypasses that safely: it only returns tags for
-- entries the caller owns, or entries where the caller was tagged.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_entry_tags(p_entry_ids integer[])
RETURNS TABLE(entry_id integer, username text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.entry_id, u.username
  FROM public.entry_tags t
  JOIN public.users u ON u.id = t.tagged_user_id
  WHERE t.entry_id = ANY(p_entry_ids)
    AND (
      EXISTS (
        SELECT 1
        FROM public.diary_entries e
        JOIN public.users me ON me.id = e.user_id
        WHERE e.id = t.entry_id
          AND me.auth_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.users me
        WHERE me.id = t.tagged_user_id
          AND me.auth_id = auth.uid()
      )
    )
  ORDER BY t.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_entry_tags(integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entry_tags(integer[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
