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

function normalizeSearchTerm(raw: string | null) {
  if (!raw) {
    return "";
  }

  return raw.trim().slice(0, 120);
}

export const Route = createFileRoute("/api/diary/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const q = normalizeSearchTerm(url.searchParams.get("q"));
        const likeParam = `%${q}%`;

        try {
          const db = getDbPool();
          const result = await db.query<{
            id: string | number;
            title: string | null;
            content: string;
            entry_date: string;
            song_title: string | null;
            song_artist: string | null;
            song_url: string | null;
            photo_count: number;
            photo_urls: string[];
            created_at: string;
          }>(
            `
              SELECT
                de.id,
                de.title,
                de.content,
                de.entry_date,
                de.song_title,
                de.song_artist,
                de.song_url,
                (
                  SELECT COUNT(*)::int
                  FROM public.entry_photos ep
                  WHERE ep.entry_id = de.id
                ) AS photo_count,
                COALESCE(
                  (
                    SELECT array_agg(ep.photo_url ORDER BY ep.created_at DESC)
                    FROM public.entry_photos ep
                    WHERE ep.entry_id = de.id
                  ),
                  ARRAY[]::text[]
                ) AS photo_urls,
                de.created_at
              FROM public.diary_entries de
              WHERE de.user_id = $1
                AND (
                  $2 = ''
                  OR COALESCE(de.title, '') ILIKE $3
                  OR de.content ILIKE $3
                )
              ORDER BY
                CASE
                  WHEN $2 <> '' AND COALESCE(de.title, '') ILIKE $3 THEN 0
                  WHEN $2 <> '' AND de.content ILIKE $3 THEN 1
                  ELSE 2
                END,
                de.entry_date DESC,
                de.created_at DESC
              LIMIT 24
            `,
            [userId, q, likeParam],
          );

          return Response.json({ entries: result.rows, query: q }, { status: 200 });
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          console.error("Diary search API error", error);
          return Response.json({ message: "No se pudieron buscar las entradas" }, { status: 500 });
        }
      },
    },
  },
});
