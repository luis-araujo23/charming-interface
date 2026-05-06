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

function parseYearMonth(url: URL) {
  const now = new Date();
  const yearRaw = Number(url.searchParams.get("year"));
  const monthRaw = Number(url.searchParams.get("month"));

  const year = Number.isInteger(yearRaw) && yearRaw >= 1900 && yearRaw <= 2100 ? yearRaw : now.getFullYear();
  const month = Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1;

  return { year, month };
}

export const Route = createFileRoute("/api/diary/calendar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const { year, month } = parseYearMonth(url);

        try {
          const supabase = getSupabaseAdmin();
          const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
          const monthEndDate = new Date(Date.UTC(year, month, 0));
          const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(monthEndDate.getUTCDate()).padStart(2, "0")}`;

          const { data: entries, error: entriesError } = await supabase
            .from("diary_entries")
            .select("entry_date")
            .eq("user_id", userId)
            .gte("entry_date", monthStart)
            .lte("entry_date", monthEnd);

          if (entriesError) {
            throw entriesError;
          }

          const dayCountMap = new Map<number, number>();
          for (const row of entries ?? []) {
            const date = new Date(`${row.entry_date}T00:00:00Z`);
            const day = date.getUTCDate();
            dayCountMap.set(day, (dayCountMap.get(day) ?? 0) + 1);
          }

          const days = [...dayCountMap.entries()]
            .map(([day, count]) => ({ day, count }))
            .sort((a, b) => a.day - b.day);

          return Response.json(
            {
              year,
              month,
              days,
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

          console.error("Diary calendar API error", error);
          return Response.json({ message: "No se pudo cargar el calendario" }, { status: 500 });
        }
      },
    },
  },
});
