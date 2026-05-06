import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

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
          const supabase = getSupabaseAdmin();
          const { data: result, error: deleteError } = await supabase
            .from("friendships")
            .delete()
            .eq("id", friendshipId)
            .eq("status", "accepted")
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .select("id");

          if (deleteError) {
            throw deleteError;
          }

          if (!result || result.length === 0) {
            return Response.json({ message: "No se encontró la amistad para borrar." }, { status: 404 });
          }

          return Response.json({ message: "Amistad eliminada." }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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