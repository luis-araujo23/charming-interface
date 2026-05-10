import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

function getSessionUserId(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = verifySessionToken(token);
  if (!session) {
    return null;
  }

  const userIdNumber = Number(session.userId);
  if (!Number.isFinite(userIdNumber)) {
    return null;
  }

  return userIdNumber;
}

function buildWeekDays(weekStartDate: string, writtenDates: Set<string>) {
  const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const start = new Date(`${weekStartDate}T00:00:00`);

  return weekDays.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateIso = date.toISOString().slice(0, 10);

    return {
      label,
      date: dateIso,
      written: writtenDates.has(dateIso),
    };
  });
}

export const Route = createFileRoute("/api/streaks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const db = getDbPool();

          const syncResult = await db.query<{
            week_start_date: string;
            week_end_date: string;
            days_written: number;
            completed: boolean;
          }>(
            `
              WITH week_bounds AS (
                SELECT
                  DATE_TRUNC('week', CURRENT_DATE)::date AS week_start_date,
                  (DATE_TRUNC('week', CURRENT_DATE)::date + 6) AS week_end_date
              ),
              week_stats AS (
                SELECT
                  wb.week_start_date,
                  wb.week_end_date,
                  COUNT(DISTINCT de.entry_date)::int AS days_written
                FROM week_bounds wb
                LEFT JOIN public.diary_entries de
                  ON de.user_id = $1::int
                  AND de.entry_date BETWEEN wb.week_start_date AND wb.week_end_date
                GROUP BY wb.week_start_date, wb.week_end_date
              ),
              upserted AS (
                INSERT INTO public.weekly_streaks (user_id, week_start_date, week_end_date, days_written, completed)
                SELECT
                  $1::int,
                  ws.week_start_date,
                  ws.week_end_date,
                  ws.days_written,
                  ws.days_written >= 7
                FROM week_stats ws
                ON CONFLICT (user_id, week_start_date)
                DO UPDATE SET
                  week_end_date = EXCLUDED.week_end_date,
                  days_written = EXCLUDED.days_written,
                  completed = EXCLUDED.completed,
                  updated_at = NOW()
                RETURNING week_start_date, week_end_date, days_written, completed
              )
              SELECT
                up.week_start_date::text AS week_start_date,
                up.week_end_date::text AS week_end_date,
                up.days_written,
                up.completed
              FROM upserted up
              LIMIT 1
            `,
            [userId],
          );

          const synced = syncResult.rows[0];
          const weekStartDate = synced.week_start_date;
          const weekEndDate = synced.week_end_date;
          const daysWritten = synced.days_written;
          const completed = synced.completed;

          const entriesResult = await db.query<{ entry_date: string }>(
            `
              SELECT DISTINCT de.entry_date::text AS entry_date
              FROM public.diary_entries de
              WHERE de.user_id = $1::int
                AND de.entry_date BETWEEN $2::date AND $3::date
            `,
            [userId, weekStartDate, weekEndDate],
          );

          const writtenDates = new Set(entriesResult.rows.map((row) => row.entry_date));

          const completedHistoryResult = await db.query<{
            week_start_date: string;
            week_end_date: string;
            days_written: number;
            completed: boolean;
            created_at: string;
            updated_at: string;
          }>(
            `
              SELECT
                ws.week_start_date::text AS week_start_date,
                ws.week_end_date::text AS week_end_date,
                ws.days_written,
                ws.completed,
                ws.created_at::text AS created_at,
                ws.updated_at::text AS updated_at
              FROM public.weekly_streaks ws
              WHERE ws.user_id = $1::int
                AND ws.completed = TRUE
              ORDER BY ws.week_start_date DESC
            `,
            [userId],
          );

          const completedWeeksHistory = completedHistoryResult.rows.map((row) => ({
            weekStartDate: row.week_start_date,
            weekEndDate: row.week_end_date,
            daysWritten: row.days_written,
            completed: row.completed,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          return Response.json(
            {
              weekStartDate,
              weekEndDate,
              daysWritten,
              completed,
              days: buildWeekDays(weekStartDate, writtenDates),
              totalCompletedWeeks: completedWeeksHistory.length,
              completedWeeksHistory,
            },
            { status: 200 },
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          console.error("Streak API error", error);
          return Response.json({ message: "No se pudo cargar la racha semanal." }, { status: 500 });
        }
      },
    },
  },
});
