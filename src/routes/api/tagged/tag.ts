import { createFileRoute } from "@tanstack/react-router";
import type { DatabaseError } from "pg";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type CreateTagPayload = {
  entryId?: unknown;
  username?: unknown;
};

function getErrorCode(error: unknown) {
  return (error as DatabaseError | undefined)?.code;
}

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

export const Route = createFileRoute("/api/tagged/tag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: CreateTagPayload;

        try {
          payload = (await request.json()) as CreateTagPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const entryId = Number(payload.entryId);
        const username = typeof payload.username === "string" ? payload.username.trim().toLowerCase() : "";

        if (!Number.isInteger(entryId) || entryId <= 0) {
          return Response.json({ message: "entryId inválido." }, { status: 400 });
        }

        if (!username) {
          return Response.json({ message: "Debes indicar el username a etiquetar." }, { status: 400 });
        }

        try {
          const db = getDbPool();

          const ownerResult = await db.query<{ id: string | number }>(
            `
              SELECT id
              FROM public.diary_entries
              WHERE id = $1::int
                AND user_id = $2::int
              LIMIT 1
            `,
            [entryId, userId],
          );

          if (ownerResult.rowCount === 0) {
            return Response.json({ message: "Solo puedes etiquetar en tus propias entradas." }, { status: 403 });
          }

          const targetResult = await db.query<{ id: string | number; username: string }>(
            `
              SELECT id, username
              FROM public.users
              WHERE LOWER(username) = $1
              LIMIT 1
            `,
            [username],
          );

          if (targetResult.rowCount === 0) {
            return Response.json({ message: "No encontramos un usuario con ese username." }, { status: 404 });
          }

          const taggedUserId = Number(targetResult.rows[0].id);

          if (taggedUserId === userId) {
            return Response.json({ message: "No puedes etiquetarte a ti mismo." }, { status: 400 });
          }

          const friendResult = await db.query<{ exists: boolean }>(
            `
              SELECT EXISTS (
                SELECT 1
                FROM public.friendships f
                WHERE f.status = 'accepted'
                  AND (
                    (f.requester_id = $1::int AND f.addressee_id = $2::int)
                    OR (f.addressee_id = $1::int AND f.requester_id = $2::int)
                  )
              ) AS exists
            `,
            [userId, taggedUserId],
          );

          if (!friendResult.rows[0]?.exists) {
            return Response.json({ message: "Solo puedes etiquetar amigos aceptados." }, { status: 400 });
          }

          await db.query(
            `
              INSERT INTO public.entry_tags (entry_id, tagged_user_id, tagged_by_user_id)
              VALUES ($1::int, $2::int, $3::int)
            `,
            [entryId, taggedUserId, userId],
          );

          return Response.json({ message: "Usuario etiquetado correctamente." }, { status: 201 });
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          if (getErrorCode(error) === "23505") {
            return Response.json({ message: "Ese usuario ya está etiquetado en esta entrada." }, { status: 409 });
          }

          console.error("Tag user API error", error);
          return Response.json({ message: "No se pudo etiquetar al usuario" }, { status: 500 });
        }
      },
    },
  },
});