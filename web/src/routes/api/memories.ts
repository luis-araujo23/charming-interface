import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type CreateMemoryPayload = {
  entry_id?: unknown;
  selected_text?: unknown;
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

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getReadableErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const details = "details" in error && typeof error.details === "string" ? error.details : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const hint = "hint" in error && typeof error.hint === "string" ? error.hint : "";
  return [message, details, hint].filter(Boolean).join(" ").toLowerCase();
}

export const Route = createFileRoute("/api/memories")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const supabase = getSupabaseAdmin();
          let useSelectedTextColumn = true;

          let { data, error } = await supabase
            .from("remembered_entries")
            .select("id, user_id, entry_id, memory_date, created_at, selected_text, diary_entries!inner(id, user_id, title, entry_date, content)")
            .eq("user_id", userId)
            .order("memory_date", { ascending: false })
            .order("created_at", { ascending: false });

          if (error) {
            const readable = getReadableErrorMessage(error) ?? "";
            if (readable.includes("selected_text")) {
              useSelectedTextColumn = false;
              const fallback = await supabase
                .from("remembered_entries")
                .select("id, user_id, entry_id, memory_date, created_at, diary_entries!inner(id, user_id, title, entry_date, content)")
                .eq("user_id", userId)
                .order("memory_date", { ascending: false })
                .order("created_at", { ascending: false });

              data = fallback.data;
              error = fallback.error;
            }
          }

          if (error) {
            throw error;
          }

          const memories = (data ?? []).map((row) => {
            const entry = Array.isArray(row.diary_entries) ? row.diary_entries[0] : row.diary_entries;
            const selectedText = useSelectedTextColumn
              ? ("selected_text" in row && typeof row.selected_text === "string" ? row.selected_text : "")
              : "";

            return {
              id: Number(row.id),
              entryId: Number(row.entry_id),
              entryTitle: entry?.title?.trim() || "Entrada sin título",
              entryDate: entry?.entry_date ?? row.memory_date,
              memoryDate: row.memory_date,
              selectedText: selectedText || entry?.content || "",
              createdAt: row.created_at,
            };
          });

          return Response.json({ memories }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Memories list API error", error);
          return Response.json({ message: "No se pudieron cargar los recuerdos." }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: CreateMemoryPayload;
        try {
          payload = (await request.json()) as CreateMemoryPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const entryId = Number(payload.entry_id);
        const selectedText = asTrimmedString(payload.selected_text);

        if (!Number.isInteger(entryId) || entryId <= 0) {
          return Response.json({ message: "La entrada seleccionada no es válida." }, { status: 400 });
        }

        if (!selectedText) {
          return Response.json({ message: "Selecciona un texto para guardar en recuerdos." }, { status: 400 });
        }

        if (selectedText.length > 2000) {
          return Response.json({ message: "El texto seleccionado es demasiado largo (máximo 2000 caracteres)." }, { status: 400 });
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data: entry, error: entryError } = await supabase
            .from("diary_entries")
            .select("id, user_id, entry_date")
            .eq("id", entryId)
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (entryError) {
            throw entryError;
          }

          if (!entry) {
            return Response.json({ message: "No encontramos esa entrada en tu diario." }, { status: 404 });
          }

          const insertResult = await supabase
            .from("remembered_entries")
            .insert({
              user_id: userId,
              entry_id: entryId,
              memory_date: entry.entry_date,
              selected_text: selectedText,
            })
            .select("id")
            .single();

          if (insertResult.error) {
            const readable = getReadableErrorMessage(insertResult.error) ?? "";
            if (readable.includes("selected_text")) {
              return Response.json(
                {
                  message:
                    "Tu base de datos aún no tiene la columna selected_text en remembered_entries. Agrégala para guardar exactamente el fragmento seleccionado.",
                },
                { status: 500 },
              );
            }

            throw insertResult.error;
          }

          return Response.json(
            {
              message: "Recuerdo guardado correctamente.",
              memoryId: insertResult.data.id,
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

          console.error("Memories create API error", error);
          return Response.json({ message: "No se pudo guardar el recuerdo." }, { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const memoryId = Number(url.searchParams.get("id"));

        if (!Number.isInteger(memoryId) || memoryId <= 0) {
          return Response.json({ message: "ID de recuerdo inválido." }, { status: 400 });
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("remembered_entries")
            .delete()
            .eq("id", memoryId)
            .eq("user_id", userId)
            .select("id");

          if (error) {
            throw error;
          }

          if (!data || data.length === 0) {
            return Response.json({ message: "No encontramos ese recuerdo." }, { status: 404 });
          }

          return Response.json({ message: "Recuerdo eliminado." }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Memories delete API error", error);
          return Response.json({ message: "No se pudo eliminar el recuerdo." }, { status: 500 });
        }
      },
    },
  },
});