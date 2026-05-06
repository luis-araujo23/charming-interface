import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

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
          const supabase = getSupabaseAdmin();
          const { data: result, error: updateError } = await supabase
            .from("friendships")
            .update({ status: action === "accept" ? "accepted" : "rejected" })
            .eq("id", friendshipId)
            .eq("addressee_id", userId)
            .eq("status", "pending")
            .select("id");

          if (updateError) {
            throw updateError;
          }

          if (!result || result.length === 0) {
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
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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