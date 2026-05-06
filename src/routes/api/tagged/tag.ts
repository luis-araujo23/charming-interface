import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getErrorCode, getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type CreateTagPayload = {
  entryId?: unknown;
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
          const supabase = getSupabaseAdmin();

          const { data: ownerEntry, error: ownerError } = await supabase
            .from("diary_entries")
            .select("id")
            .eq("id", entryId)
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (ownerError) {
            throw ownerError;
          }

          if (!ownerEntry) {
            return Response.json({ message: "Solo puedes etiquetar en tus propias entradas." }, { status: 403 });
          }

          const { data: targetUser, error: targetError } = await supabase
            .from("users")
            .select("id, username")
            .ilike("username", username)
            .limit(1)
            .maybeSingle();

          if (targetError) {
            throw targetError;
          }

          if (!targetUser) {
            return Response.json({ message: "No encontramos un usuario con ese username." }, { status: 404 });
          }

          const taggedUserId = Number(targetUser.id);

          if (taggedUserId === userId) {
            return Response.json({ message: "No puedes etiquetarte a ti mismo." }, { status: 400 });
          }

          const { data: friendship, error: friendshipError } = await supabase
            .from("friendships")
            .select("id")
            .eq("status", "accepted")
            .in("requester_id", [userId, taggedUserId])
            .in("addressee_id", [userId, taggedUserId])
            .limit(1)
            .maybeSingle();

          if (friendshipError) {
            throw friendshipError;
          }

          if (!friendship) {
            return Response.json({ message: "Solo puedes etiquetar amigos aceptados." }, { status: 400 });
          }

          const { error: insertError } = await supabase.from("entry_tags").insert({
            entry_id: entryId,
            tagged_user_id: taggedUserId,
            tagged_by_user_id: userId,
          });

          if (insertError) {
            throw insertError;
          }

          return Response.json({ message: "Usuario etiquetado correctamente." }, { status: 201 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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