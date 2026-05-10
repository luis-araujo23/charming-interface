import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

type RespondPayload = {
  friendshipId?: unknown;
  action?: unknown;
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

export const Route = createFileRoute("/api/friends/respond")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: RespondPayload;

        try {
          payload = (await request.json()) as RespondPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const friendshipId = Number(payload.friendshipId);
        const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";

        if (!Number.isInteger(friendshipId) || friendshipId <= 0) {
          return Response.json({ message: "friendshipId inválido." }, { status: 400 });
        }

        if (action !== "accept" && action !== "reject") {
          return Response.json({ message: "La acción debe ser accept o reject." }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const result = await db.query<{ id: string | number }>(
            `
              UPDATE public.friendships
              SET
                status = $1,
                updated_at = now()
              WHERE id = $2::int
                AND addressee_id = $3::int
                AND status = 'pending'
              RETURNING id
            `,
            [action === "accept" ? "accepted" : "rejected", friendshipId, userId],
          );

          if (result.rowCount === 0) {
            return Response.json(
              { message: "No encontramos una solicitud pendiente para responder." },
              { status: 404 },
            );
          }

          return Response.json(
            {
              message: action === "accept" ? "Solicitud aceptada." : "Solicitud rechazada.",
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

          console.error("Friend respond API error", error);
          return Response.json({ message: "No se pudo responder la solicitud" }, { status: 500 });
        }
      },
    },
  },
});