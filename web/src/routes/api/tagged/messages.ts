import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type CreateTaggedMessagePayload = {
  entryTagId?: unknown;
  message?: unknown;
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

export const Route = createFileRoute("/api/tagged/messages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: CreateTaggedMessagePayload;

        try {
          payload = (await request.json()) as CreateTaggedMessagePayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const entryTagId = Number(payload.entryTagId);
        const message = typeof payload.message === "string" ? payload.message.trim() : "";

        if (!Number.isInteger(entryTagId) || entryTagId <= 0) {
          return Response.json({ message: "entryTagId inválido." }, { status: 400 });
        }

        if (!message) {
          return Response.json({ message: "El mensaje no puede estar vacío." }, { status: 400 });
        }

        if (message.length > 1200) {
          return Response.json({ message: "El mensaje puede tener máximo 1200 caracteres." }, { status: 400 });
        }

        try {
          const db = getDbPool();

          const relationResult = await db.query<{ id: string | number }>(
            `
              SELECT id
              FROM public.entry_tags
              WHERE id = $1::int
                AND (tagged_user_id = $2::int OR tagged_by_user_id = $2::int)
              LIMIT 1
            `,
            [entryTagId, userId],
          );

          if (relationResult.rowCount === 0) {
            return Response.json({ message: "No tienes permisos para comentar esta etiqueta." }, { status: 403 });
          }

          const insertResult = await db.query<{
            id: string | number;
            entry_tag_id: string | number;
            author_id: string | number;
            author_username: string;
            message: string;
            created_at: string;
          }>(
            `
              WITH inserted AS (
                INSERT INTO public.tagged_entry_messages (entry_tag_id, author_id, message)
                VALUES ($1::int, $2::int, $3)
                RETURNING id, entry_tag_id, author_id, message, created_at
              )
              SELECT
                inserted.id,
                inserted.entry_tag_id,
                inserted.author_id,
                u.username AS author_username,
                inserted.message,
                inserted.created_at
              FROM inserted
              INNER JOIN public.users u ON u.id = inserted.author_id
            `,
            [entryTagId, userId, message],
          );

          const row = insertResult.rows[0];
          return Response.json(
            {
              message: "Comentario enviado.",
              comment: {
                id: Number(row.id),
                entryTagId: Number(row.entry_tag_id),
                authorId: Number(row.author_id),
                authorUsername: row.author_username,
                message: row.message,
                createdAt: row.created_at,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          console.error("Tagged messages API error", error);
          return Response.json({ message: "No se pudo publicar el comentario" }, { status: 500 });
        }
      },
    },
  },
});