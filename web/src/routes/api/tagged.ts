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

export const Route = createFileRoute("/api/tagged")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const db = getDbPool();
          const taggedEntriesResult = await db.query<{
            entry_tag_id: string | number;
            entry_id: string | number;
            title: string | null;
            content: string;
            entry_date: string;
            tagged_by_username: string;
            created_at: string;
          }>(
            `
              SELECT
                et.id AS entry_tag_id,
                de.id AS entry_id,
                de.title,
                de.content,
                de.entry_date,
                tagger.username AS tagged_by_username,
                et.created_at
              FROM public.entry_tags et
              INNER JOIN public.diary_entries de ON de.id = et.entry_id
              INNER JOIN public.users tagger ON tagger.id = et.tagged_by_user_id
              WHERE et.tagged_user_id = $1::int
              ORDER BY et.created_at DESC
            `,
            [userId],
          );

          const entryTagIds = taggedEntriesResult.rows
            .map((row) => Number(row.entry_tag_id))
            .filter((id) => Number.isInteger(id) && id > 0);

          const commentsByEntryTagId = new Map<
            number,
            Array<{
              id: number;
              entryTagId: number;
              authorId: number;
              authorUsername: string;
              message: string;
              createdAt: string;
            }>
          >();

          if (entryTagIds.length > 0) {
            const commentsResult = await db.query<{
              id: string | number;
              entry_tag_id: string | number;
              author_id: string | number;
              author_username: string;
              message: string;
              created_at: string;
            }>(
              `
                SELECT
                  tem.id,
                  tem.entry_tag_id,
                  tem.author_id,
                  author.username AS author_username,
                  tem.message,
                  tem.created_at
                FROM public.tagged_entry_messages tem
                INNER JOIN public.users author ON author.id = tem.author_id
                WHERE tem.entry_tag_id = ANY($1::int[])
                ORDER BY tem.created_at ASC
              `,
              [entryTagIds],
            );

            for (const row of commentsResult.rows) {
              const entryTagId = Number(row.entry_tag_id);
              const current = commentsByEntryTagId.get(entryTagId) ?? [];
              current.push({
                id: Number(row.id),
                entryTagId,
                authorId: Number(row.author_id),
                authorUsername: row.author_username,
                message: row.message,
                createdAt: row.created_at,
              });
              commentsByEntryTagId.set(entryTagId, current);
            }
          }

          return Response.json(
            {
              notes: taggedEntriesResult.rows.map((row) => {
                const entryTagId = Number(row.entry_tag_id);
                return {
                  entryTagId,
                  entryId: Number(row.entry_id),
                  title: row.title,
                  content: row.content,
                  entryDate: row.entry_date,
                  taggedByUsername: row.tagged_by_username,
                  taggedAt: row.created_at,
                  comments: commentsByEntryTagId.get(entryTagId) ?? [],
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

          console.error("Tagged entries API error", error);
          return Response.json({ message: "No se pudieron cargar las notas etiquetadas" }, { status: 500 });
        }
      },
    },
  },
});