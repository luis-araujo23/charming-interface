import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

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
          const supabase = getSupabaseAdmin();

          const { data: relation, error: relationError } = await supabase
            .from("entry_tags")
            .select("id")
            .eq("id", entryTagId)
            .or(`tagged_user_id.eq.${userId},tagged_by_user_id.eq.${userId}`)
            .limit(1)
            .maybeSingle();

          if (relationError) {
            throw relationError;
          }

          if (!relation) {
            return Response.json({ message: "No tienes permisos para comentar esta etiqueta." }, { status: 403 });
          }

          const { data: inserted, error: insertError } = await supabase
            .from("tagged_entry_messages")
            .insert({
              entry_tag_id: entryTagId,
              author_id: userId,
              message,
            })
            .select("id, entry_tag_id, author_id, message, created_at")
            .single();

          if (insertError) {
            throw insertError;
          }

          const { data: author, error: authorError } = await supabase
            .from("users")
            .select("username")
            .eq("id", userId)
            .limit(1)
            .maybeSingle();

          if (authorError) {
            throw authorError;
          }

          return Response.json(
            {
              message: "Comentario enviado.",
              comment: {
                id: Number(inserted.id),
                entryTagId: Number(inserted.entry_tag_id),
                authorId: Number(inserted.author_id),
                authorUsername: author?.username ?? "",
                message: inserted.message,
                createdAt: inserted.created_at,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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