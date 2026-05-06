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

export const Route = createFileRoute("/api/friends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const db = getDbPool();

          const pendingResult = await db.query<{
            friendship_id: string | number;
            user_id: string | number;
            username: string;
          }>(
            `
              SELECT
                f.id AS friendship_id,
                u.id AS user_id,
                u.username
              FROM public.friendships f
              INNER JOIN public.users u ON u.id = f.requester_id
              WHERE f.addressee_id = $1::int
                AND f.status = 'pending'
              ORDER BY f.created_at DESC
            `,
            [userId],
          );

          const outgoingPendingResult = await db.query<{
            friendship_id: string | number;
            user_id: string | number;
            username: string;
          }>(
            `
              SELECT
                f.id AS friendship_id,
                u.id AS user_id,
                u.username
              FROM public.friendships f
              INNER JOIN public.users u ON u.id = f.addressee_id
              WHERE f.requester_id = $1::int
                AND f.status = 'pending'
              ORDER BY f.created_at DESC
            `,
            [userId],
          );

          const friendsResult = await db.query<{
            friendship_id: string | number;
            user_id: string | number;
            username: string;
          }>(
            `
              SELECT
                f.id AS friendship_id,
                u.id AS user_id,
                u.username
              FROM public.friendships f
              INNER JOIN public.users u
                ON u.id = CASE
                  WHEN f.requester_id = $1::int THEN f.addressee_id
                  ELSE f.requester_id
                END
              WHERE (f.requester_id = $1::int OR f.addressee_id = $1::int)
                AND f.status = 'accepted'
              ORDER BY u.username ASC
            `,
            [userId],
          );

          return Response.json(
            {
              pendingRequests: pendingResult.rows.map((row) => ({
                friendshipId: Number(row.friendship_id),
                userId: Number(row.user_id),
                username: row.username,
              })),
              outgoingPendingRequests: outgoingPendingResult.rows.map((row) => ({
                friendshipId: Number(row.friendship_id),
                userId: Number(row.user_id),
                username: row.username,
              })),
              friends: friendsResult.rows.map((row) => ({
                friendshipId: Number(row.friendship_id),
                userId: Number(row.user_id),
                username: row.username,
              })),
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

          console.error("Friends list API error", error);
          return Response.json({ message: "No se pudo cargar la lista de amigos" }, { status: 500 });
        }
      },
    },
  },
});