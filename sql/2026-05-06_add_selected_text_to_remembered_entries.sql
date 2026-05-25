-- Safe migration: add selected_text to remembered_entries without breaking existing data.
-- Idempotent: can be executed multiple times.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'remembered_entries'
  ) THEN
    ALTER TABLE public.remembered_entries
      ADD COLUMN IF NOT EXISTS selected_text text;

    COMMENT ON COLUMN public.remembered_entries.selected_text
      IS 'Exact text fragment selected from a diary entry.';
  END IF;
END
$$;

COMMIT;

-- Optional verification queries (run after migration):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'remembered_entries'
--   AND column_name = 'selected_text';
--
-- SELECT id, entry_id, memory_date, LEFT(selected_text, 80) AS preview
-- FROM public.remembered_entries
-- ORDER BY created_at DESC
-- LIMIT 10;
