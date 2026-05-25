import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

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

export const Route = createFileRoute("/api/tagged")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data: entryTags, error: tagsError } = await supabase
            .from("entry_tags")
            .select("id, entry_id, tagged_by_user_id, created_at")
            .eq("tagged_user_id", userId)
            .order("created_at", { ascending: false });

          if (tagsError) {
            throw tagsError;
          }

          const entryTagIds = (entryTags ?? [])
            .map((row) => Number(row.id))
            .filter((id) => Number.isInteger(id) && id > 0);

          const entryIds = [...new Set((entryTags ?? []).map((row) => Number(row.entry_id)))];
          const taggerIds = [...new Set((entryTags ?? []).map((row) => Number(row.tagged_by_user_id)))];

          let entriesById = new Map<number, { id: number; title: string | null; content: string; entry_date: string }>();
          if (entryIds.length > 0) {
            const { data: entries, error: entriesError } = await supabase
              .from("diary_entries")
              .select("id, title, content, entry_date")
              .in("id", entryIds);

            if (entriesError) {
              throw entriesError;
            }

            entriesById = new Map(
              (entries ?? []).map((row) => [Number(row.id), { id: Number(row.id), title: row.title, content: row.content, entry_date: row.entry_date }]),
            );
          }

          let usernamesById = new Map<number, string>();
          if (taggerIds.length > 0) {
            const { data: users, error: usersError } = await supabase
              .from("users")
              .select("id, username")
              .in("id", taggerIds);

            if (usersError) {
              throw usersError;
            }

            usernamesById = new Map((users ?? []).map((row) => [Number(row.id), row.username]));
          }

          const commentsByEntryTagId = new Map<
            number,
            Array<{
              id: number;
              entryTagId: number;
              authorId: number;
              authorUsername: string;
              message: string;
              createdAt: string;
            }>
          >();

          if (entryTagIds.length > 0) {
            const { data: comments, error: commentsError } = await supabase
              .from("tagged_entry_messages")
              .select("id, entry_tag_id, author_id, message, created_at")
              .in("entry_tag_id", entryTagIds)
              .order("created_at", { ascending: true });

            if (commentsError) {
              throw commentsError;
            }

            const authorIds = [...new Set((comments ?? []).map((row) => Number(row.author_id)))];
            const { data: authors, error: authorsError } = authorIds.length > 0
              ? await supabase.from("users").select("id, username").in("id", authorIds)
              : { data: [], error: null };

            if (authorsError) {
              throw authorsError;
            }

            const authorUsernameById = new Map((authors ?? []).map((row) => [Number(row.id), row.username]));

            for (const row of comments ?? []) {
              const entryTagId = Number(row.entry_tag_id);
              const current = commentsByEntryTagId.get(entryTagId) ?? [];
              current.push({
                id: Number(row.id),
                entryTagId,
                authorId: Number(row.author_id),
                authorUsername: authorUsernameById.get(Number(row.author_id)) ?? "",
                message: row.message,
                createdAt: row.created_at,
              });
              commentsByEntryTagId.set(entryTagId, current);
            }
          }

          return Response.json(
            {
              notes: (entryTags ?? []).map((row) => {
                const entryTagId = Number(row.id);
                const entry = entriesById.get(Number(row.entry_id));
                return {
                  entryTagId,
                  entryId: Number(row.entry_id),
                  title: entry?.title ?? null,
                  content: entry?.content ?? "",
                  entryDate: entry?.entry_date ?? "",
                  taggedByUsername: usernamesById.get(Number(row.tagged_by_user_id)) ?? "",
                  taggedAt: row.created_at,
                  comments: commentsByEntryTagId.get(entryTagId) ?? [],
                };
              }),
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

          console.error("Tagged entries API error", error);
          return Response.json({ message: "No se pudieron cargar las notas etiquetadas" }, { status: 500 });
        }
      },
    },
  },
});