import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type DeleteFriendshipPayload = {
  friendshipId?: unknown;
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

export const Route = createFileRoute("/api/friends/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: DeleteFriendshipPayload;

        try {
          payload = (await request.json()) as DeleteFriendshipPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const friendshipId = Number(payload.friendshipId);

        if (!Number.isInteger(friendshipId) || friendshipId <= 0) {
          return Response.json({ message: "friendshipId inválido." }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const result = await db.query<{ id: string | number }>(
            `
              DELETE FROM public.friendships
              WHERE id = $1::int
                AND status = 'accepted'
                AND (requester_id = $2::int OR addressee_id = $2::int)
              RETURNING id
            `,
            [friendshipId, userId],
          );

          if (result.rowCount === 0) {
            return Response.json({ message: "No se encontró la amistad para borrar." }, { status: 404 });
          }

          return Response.json({ message: "Amistad eliminada." }, { status: 200 });
        } catch (error) {
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
              { status: 500 },
            );
          }

          console.error("Friend delete API error", error);
          return Response.json({ message: "No se pudo borrar la amistad" }, { status: 500 });
        }
      },
    },
  },
});