import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type CreateDiaryPayload = {
  title?: unknown;
  content?: unknown;
  song_title?: unknown;
  song_artist?: unknown;
  song_url?: unknown;
  tagged_usernames?: unknown;
};

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

function asNullableTrimmed(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseTaggedUsernames(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter(Boolean),
    )];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  return [] as string[];
}

export const Route = createFileRoute("/api/diary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const dateFilter = url.searchParams.get("date");

        if (dateFilter && !isIsoDate(dateFilter)) {
          return Response.json({ message: "La fecha debe tener formato YYYY-MM-DD." }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const baseQuery = `
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
                (
                  SELECT COUNT(*)::int
                  FROM public.entry_tags et
                  WHERE et.entry_id = de.id
                ) AS tag_count,
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
            `;

          const result = await db.query<{
            id: string | number;
            title: string | null;
            content: string;
            entry_date: string;
            song_title: string | null;
            song_artist: string | null;
            song_url: string | null;
            photo_count: number;
            tag_count: number;
            photo_urls: string[];
            created_at: string;
          }>(
            dateFilter
              ? `${baseQuery}
                 AND de.entry_date = $2::date
                 ORDER BY entry_date DESC, created_at DESC`
              : `${baseQuery}
                 ORDER BY entry_date DESC, created_at DESC`,
            dateFilter ? [userId, dateFilter] : [userId],
          );

          const entryIds = result.rows
            .map((row) => Number(row.id))
            .filter((id) => Number.isInteger(id) && id > 0);

          const taggedUsersByEntryId = new Map<number, string[]>();
          const tagCommentsByEntryId = new Map<
            number,
            Array<{
              id: number;
              entryTagId: number;
              authorId: number;
              authorUsername: string;
              taggedUserUsername: string;
              message: string;
              createdAt: string;
            }>
          >();

          if (entryIds.length > 0) {
            const tagsResult = await db.query<{
              entry_id: string | number;
              entry_tag_id: string | number;
              tagged_user_username: string;
            }>(
              `
                SELECT
                  et.entry_id,
                  et.id AS entry_tag_id,
                  tagged_user.username AS tagged_user_username
                FROM public.entry_tags et
                INNER JOIN public.users tagged_user ON tagged_user.id = et.tagged_user_id
                WHERE et.entry_id = ANY($1::int[])
                ORDER BY et.created_at ASC
              `,
              [entryIds],
            );

            const entryTagIds: number[] = [];

            for (const row of tagsResult.rows) {
              const entryId = Number(row.entry_id);
              const entryTagId = Number(row.entry_tag_id);
              const taggedUsers = taggedUsersByEntryId.get(entryId) ?? [];
              taggedUsers.push(row.tagged_user_username);
              taggedUsersByEntryId.set(entryId, taggedUsers);
              entryTagIds.push(entryTagId);
            }

            if (entryTagIds.length > 0) {
              const commentsResult = await db.query<{
                id: string | number;
                entry_id: string | number;
                entry_tag_id: string | number;
                author_id: string | number;
                author_username: string;
                tagged_user_username: string;
                message: string;
                created_at: string;
              }>(
                `
                  SELECT
                    tem.id,
                    et.entry_id,
                    et.id AS entry_tag_id,
                    tem.author_id,
                    author.username AS author_username,
                    tagged_user.username AS tagged_user_username,
                    tem.message,
                    tem.created_at
                  FROM public.tagged_entry_messages tem
                  INNER JOIN public.entry_tags et ON et.id = tem.entry_tag_id
                  INNER JOIN public.users author ON author.id = tem.author_id
                  INNER JOIN public.users tagged_user ON tagged_user.id = et.tagged_user_id
                  WHERE tem.entry_tag_id = ANY($1::int[])
                  ORDER BY tem.created_at ASC
                `,
                [entryTagIds],
              );

              for (const row of commentsResult.rows) {
                const entryId = Number(row.entry_id);
                const currentComments = tagCommentsByEntryId.get(entryId) ?? [];
                currentComments.push({
                  id: Number(row.id),
                  entryTagId: Number(row.entry_tag_id),
                  authorId: Number(row.author_id),
                  authorUsername: row.author_username,
                  taggedUserUsername: row.tagged_user_username,
                  message: row.message,
                  createdAt: row.created_at,
                });
                tagCommentsByEntryId.set(entryId, currentComments);
              }
            }
          }

          return Response.json(
            {
              entries: result.rows.map((row) => {
                const entryId = Number(row.id);
                return {
                  ...row,
                  tagged_users: taggedUsersByEntryId.get(entryId) ?? [],
                  tagged_comments: tagCommentsByEntryId.get(entryId) ?? [],
                };
              }),
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

          console.error("Diary list API error", error);
          return Response.json({ message: "No se pudieron cargar las entradas" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: CreateDiaryPayload;

        try {
          payload = (await request.json()) as CreateDiaryPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const title = asNullableTrimmed(payload.title);
        const content = asNullableTrimmed(payload.content);
        const songTitle = asNullableTrimmed(payload.song_title);
        const songArtist = asNullableTrimmed(payload.song_artist);
        const songUrl = asNullableTrimmed(payload.song_url);
        const taggedUsernames = parseTaggedUsernames(payload.tagged_usernames);

        if (!content) {
          return Response.json({ message: "El contenido de la entrada es obligatorio." }, { status: 400 });
        }

        if (title && title.length > 25) {
          return Response.json({ message: "El título puede tener máximo 25 caracteres." }, { status: 400 });
        }

        if (taggedUsernames.length > 10) {
          return Response.json({ message: "Puedes etiquetar hasta 10 usuarios por entrada." }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const client = await db.connect();

          try {
            await client.query("BEGIN");

            const result = await client.query<{
              id: string | number;
              title: string | null;
              content: string;
              entry_date: string;
              song_title: string | null;
              song_artist: string | null;
              song_url: string | null;
              created_at: string;
            }>(
              `
                INSERT INTO public.diary_entries (user_id, title, content, song_title, song_artist, song_url)
                VALUES ($1::int, $2, $3, $4, $5, $6)
                RETURNING id, title, content, entry_date, song_title, song_artist, song_url, created_at
              `,
              [userId, title, content, songTitle, songArtist, songUrl],
            );

            const createdEntryId = Number(result.rows[0].id);

            if (taggedUsernames.length > 0) {
              const usersResult = await client.query<{
                id: string | number;
                username: string;
                is_friend: boolean;
              }>(
                `
                  SELECT
                    u.id,
                    u.username,
                    EXISTS (
                      SELECT 1
                      FROM public.friendships f
                      WHERE f.status = 'accepted'
                        AND (
                          (f.requester_id = $1::int AND f.addressee_id = u.id)
                          OR (f.addressee_id = $1::int AND f.requester_id = u.id)
                        )
                    ) AS is_friend
                  FROM public.users u
                  WHERE LOWER(u.username) = ANY($2::text[])
                `,
                [userId, taggedUsernames],
              );

              const foundByUsername = new Map(
                usersResult.rows.map((row) => [row.username.toLowerCase(), row]),
              );

              const invalidUsernames = taggedUsernames.filter((username) => {
                const row = foundByUsername.get(username);
                if (!row) {
                  return true;
                }

                return Number(row.id) === userId || !row.is_friend;
              });

              if (invalidUsernames.length > 0) {
                await client.query("ROLLBACK");
                return Response.json(
                  {
                    message:
                      `No puedes etiquetar estos usuarios (deben existir y ser amigos aceptados): ${invalidUsernames.join(", ")}`,
                  },
                  { status: 400 },
                );
              }

              for (const username of taggedUsernames) {
                const target = foundByUsername.get(username);
                if (!target) {
                  continue;
                }

                await client.query(
                  `
                    INSERT INTO public.entry_tags (entry_id, tagged_user_id, tagged_by_user_id)
                    VALUES ($1::int, $2::int, $3::int)
                    ON CONFLICT (entry_id, tagged_user_id) DO NOTHING
                  `,
                  [createdEntryId, Number(target.id), userId],
                );
              }
            }

            const createdEntryDate = result.rows[0].entry_date;

            await client.query(
              `
                WITH week_bounds AS (
                  SELECT
                    DATE_TRUNC('week', $2::date)::date AS week_start_date,
                    (DATE_TRUNC('week', $2::date)::date + 6) AS week_end_date
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
                )
                INSERT INTO public.weekly_streaks (user_id, week_start_date, week_end_date, days_written, completed)
                SELECT
                  $1::int,
                  ws.week_start_date,
                  ws.week_end_date,
                  ws.days_written,
                  ws.days_written = 7
                FROM week_stats ws
                ON CONFLICT (user_id, week_start_date)
                DO UPDATE SET
                  week_end_date = EXCLUDED.week_end_date,
                  days_written = EXCLUDED.days_written,
                  completed = EXCLUDED.completed,
                  updated_at = NOW()
              `,
              [userId, createdEntryDate],
            );

            await client.query("COMMIT");

            return Response.json(
              {
                message: "Entrada creada correctamente",
                entry: result.rows[0],
              },
              { status: 201 },
            );
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          console.error("Diary create API error", error);
          return Response.json({ message: "No se pudo crear la entrada" }, { status: 500 });
        }
      },
    },
  },
});
