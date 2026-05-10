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
          const db = getDbPool();
          const result = await db.query<{
            day: number;
            count: number;
          }>(
            `
              SELECT
                EXTRACT(DAY FROM de.entry_date)::int AS day,
                COUNT(*)::int AS count
              FROM public.diary_entries de
              WHERE de.user_id = $1
                AND EXTRACT(YEAR FROM de.entry_date) = $2
                AND EXTRACT(MONTH FROM de.entry_date) = $3
              GROUP BY de.entry_date
              ORDER BY day ASC
            `,
            [userId, year, month],
          );

          return Response.json(
            {
              year,
              month,
              days: result.rows,
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

          console.error("Diary calendar API error", error);
          return Response.json({ message: "No se pudo cargar el calendario" }, { status: 500 });
        }
      },
    },
  },
});
