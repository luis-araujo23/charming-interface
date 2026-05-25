import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

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

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentWeekBounds() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const offset = (day + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    weekStartDate: toIsoDate(start),
    weekEndDate: toIsoDate(end),
  };
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
          const supabase = getSupabaseAdmin();

          const { weekStartDate, weekEndDate } = getCurrentWeekBounds();

          const { data: weekEntries, error: weekEntriesError } = await supabase
            .from("diary_entries")
            .select("entry_date")
            .eq("user_id", userId)
            .gte("entry_date", weekStartDate)
            .lte("entry_date", weekEndDate);

          if (weekEntriesError) {
            throw weekEntriesError;
          }

          const writtenDates = new Set((weekEntries ?? []).map((row) => row.entry_date));
          const daysWritten = writtenDates.size;
          const completed = daysWritten >= 7;

          const { error: upsertError } = await supabase
            .from("weekly_streaks")
            .upsert(
              {
                user_id: userId,
                week_start_date: weekStartDate,
                week_end_date: weekEndDate,
                days_written: daysWritten,
                completed,
              },
              { onConflict: "user_id,week_start_date" },
            );

          if (upsertError) {
            throw upsertError;
          }

          const { data: completedHistoryRows, error: completedHistoryError } = await supabase
            .from("weekly_streaks")
            .select("week_start_date, week_end_date, days_written, completed, created_at, updated_at")
            .eq("user_id", userId)
            .eq("completed", true)
            .order("week_start_date", { ascending: false });

          if (completedHistoryError) {
            throw completedHistoryError;
          }

          const completedWeeksHistory = (completedHistoryRows ?? []).map((row) => ({
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
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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
