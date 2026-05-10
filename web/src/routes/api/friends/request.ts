import { createFileRoute } from "@tanstack/react-router";
import type { DatabaseError } from "pg";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type SendFriendRequestPayload = {
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

export const Route = createFileRoute("/api/friends/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: SendFriendRequestPayload;

        try {
          payload = (await request.json()) as SendFriendRequestPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const username = typeof payload.username === "string" ? payload.username.trim() : "";

        if (!username) {
          return Response.json({ message: "Debes indicar un username." }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const targetUserResult = await db.query<{ id: string | number }>(
            `
              SELECT id
              FROM public.users
              WHERE LOWER(username) = LOWER($1)
              LIMIT 1
            `,
            [username],
          );

          if (targetUserResult.rowCount === 0) {
            return Response.json({ message: "No encontramos un usuario con ese username." }, { status: 404 });
          }

          const addresseeId = Number(targetUserResult.rows[0].id);

          if (addresseeId === userId) {
            return Response.json({ message: "No puedes enviarte solicitud a ti mismo." }, { status: 400 });
          }

          const existingResult = await db.query<{ status: string }>(
            `
              SELECT status
              FROM public.friendships
              WHERE LEAST(requester_id, addressee_id) = LEAST($1::int, $2::int)
                AND GREATEST(requester_id, addressee_id) = GREATEST($1::int, $2::int)
              LIMIT 1
            `,
            [userId, addresseeId],
          );

          if (existingResult.rowCount && existingResult.rows[0]) {
            const currentStatus = existingResult.rows[0].status;

            if (currentStatus === "accepted") {
              return Response.json({ message: "Ya son amigos." }, { status: 409 });
            }

            if (currentStatus === "pending") {
              return Response.json({ message: "Ya existe una solicitud pendiente entre ustedes." }, { status: 409 });
            }

            return Response.json(
              { message: "Ya existe una relación previa entre ustedes. Actualízala antes de reenviar." },
              { status: 409 },
            );
          }

          await db.query(
            `
              INSERT INTO public.friendships (requester_id, addressee_id, status)
              VALUES ($1::int, $2::int, 'pending')
            `,
            [userId, addresseeId],
          );

          return Response.json({ message: "Solicitud enviada correctamente." }, { status: 201 });
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          if (getErrorCode(error) === "23505") {
            return Response.json({ message: "Ya existe una solicitud con ese usuario." }, { status: 409 });
          }

          console.error("Friend request API error", error);
          return Response.json({ message: "No se pudo enviar la solicitud" }, { status: 500 });
        }
      },
    },
  },
});