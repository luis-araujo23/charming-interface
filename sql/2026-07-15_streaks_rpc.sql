-- "Racha" semanal para la app de telefono (cliente autenticado, RLS).
--
-- La web calcula la racha con service_role en /api/streaks; el telefono necesita
-- un RPC SECURITY DEFINER para leer diary_entries / weekly_streaks sin chocar con
-- RLS. La logica es identica a la web:
--   1) Semana actual = Lunes..Domingo (date_trunc('week') -> lunes).
--   2) days_written = dias DISTINTOS con entrada en la semana.
--   3) completed = days_written >= 7.
--   4) Upsert en weekly_streaks (por user_id + week_start_date).
--   5) Devuelve: dias de la semana (con label/fecha/escrito), total de semanas
--      perfectas e historial de semanas completadas.
--
-- Idempotente y seguro (CREATE OR REPLACE). Ejecuta todo el archivo en el editor
-- SQL de Supabase.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_me integer;
  v_week_start date;
  v_week_end date;
  v_days_written integer;
  v_completed boolean;
  v_days jsonb;
  v_history jsonb;
  v_total integer;
  v_labels text[] := ARRAY['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
BEGIN
  -- Sin sesion o sin perfil publico: estructura vacia valida (no rompe la UI).
  IF v_auth IS NULL THEN
    RETURN jsonb_build_object(
      'weekStartDate', NULL, 'weekEndDate', NULL,
      'daysWritten', 0, 'completed', false,
      'days', '[]'::jsonb, 'totalCompletedWeeks', 0,
      'completedWeeksHistory', '[]'::jsonb
    );
  END IF;

  SELECT id INTO v_me
  FROM public.users
  WHERE auth_id = v_auth
  ORDER BY id DESC
  LIMIT 1;

  IF v_me IS NULL THEN
    RETURN jsonb_build_object(
      'weekStartDate', NULL, 'weekEndDate', NULL,
      'daysWritten', 0, 'completed', false,
      'days', '[]'::jsonb, 'totalCompletedWeeks', 0,
      'completedWeeksHistory', '[]'::jsonb
    );
  END IF;

  -- Semana Lunes..Domingo.
  v_week_start := (date_trunc('week', current_date))::date;
  v_week_end := v_week_start + 6;

  SELECT count(DISTINCT e.entry_date)
    INTO v_days_written
  FROM public.diary_entries e
  WHERE e.user_id = v_me
    AND e.entry_date >= v_week_start
    AND e.entry_date <= v_week_end;

  v_completed := v_days_written >= 7;

  -- Guarda/actualiza la racha de la semana actual.
  INSERT INTO public.weekly_streaks (user_id, week_start_date, week_end_date, days_written, completed)
  VALUES (v_me, v_week_start, v_week_end, v_days_written, v_completed)
  ON CONFLICT (user_id, week_start_date)
  DO UPDATE SET
    week_end_date = EXCLUDED.week_end_date,
    days_written = EXCLUDED.days_written,
    completed = EXCLUDED.completed;

  -- Los 7 dias de la semana actual con su estado.
  SELECT jsonb_agg(
           jsonb_build_object(
             'label', v_labels[g + 1],
             'date', to_char(v_week_start + g, 'YYYY-MM-DD'),
             'written', EXISTS (
               SELECT 1 FROM public.diary_entries e
               WHERE e.user_id = v_me AND e.entry_date = v_week_start + g
             )
           )
           ORDER BY g
         )
    INTO v_days
  FROM generate_series(0, 6) AS g;

  -- Historial de semanas completadas (mas reciente primero).
  SELECT coalesce(
           jsonb_agg(
             jsonb_build_object(
               'weekStartDate', to_char(w.week_start_date, 'YYYY-MM-DD'),
               'weekEndDate', to_char(w.week_end_date, 'YYYY-MM-DD'),
               'daysWritten', w.days_written,
               'completed', w.completed,
               'createdAt', w.created_at,
               'updatedAt', w.updated_at
             )
             ORDER BY w.week_start_date DESC
           ),
           '[]'::jsonb
         )
    INTO v_history
  FROM public.weekly_streaks w
  WHERE w.user_id = v_me AND w.completed = true;

  SELECT count(*)
    INTO v_total
  FROM public.weekly_streaks w
  WHERE w.user_id = v_me AND w.completed = true;

  RETURN jsonb_build_object(
    'weekStartDate', to_char(v_week_start, 'YYYY-MM-DD'),
    'weekEndDate', to_char(v_week_end, 'YYYY-MM-DD'),
    'daysWritten', v_days_written,
    'completed', v_completed,
    'days', coalesce(v_days, '[]'::jsonb),
    'totalCompletedWeeks', v_total,
    'completedWeeksHistory', v_history
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_streak() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_streak() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
