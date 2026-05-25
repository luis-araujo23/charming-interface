import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getErrorCode, getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type SendFriendRequestPayload = {
  username?: unknown;
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
          const supabase = getSupabaseAdmin();
          const { data: targetUser, error: targetUserError } = await supabase
            .from("users")
            .select("id")
            .ilike("username", username)
            .limit(1)
            .maybeSingle();

          if (targetUserError) {
            throw targetUserError;
          }

          if (!targetUser) {
            return Response.json({ message: "No encontramos un usuario con ese username." }, { status: 404 });
          }

          const addresseeId = Number(targetUser.id);

          if (addresseeId === userId) {
            return Response.json({ message: "No puedes enviarte solicitud a ti mismo." }, { status: 400 });
          }

          const { data: existingRelation, error: existingError } = await supabase
            .from("friendships")
            .select("status")
            .in("requester_id", [userId, addresseeId])
            .in("addressee_id", [userId, addresseeId])
            .limit(1)
            .maybeSingle();

          if (existingError) {
            throw existingError;
          }

          if (existingRelation) {
            const currentStatus = existingRelation.status;

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

          const { error: insertError } = await supabase.from("friendships").insert({
            requester_id: userId,
            addressee_id: addresseeId,
            status: "pending",
          });

          if (insertError) {
            throw insertError;
          }

          return Response.json({ message: "Solicitud enviada correctamente." }, { status: 201 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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