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

function normalizeSearchTerm(raw: string | null) {
  if (!raw) {
    return "";
  }

  return raw.trim().slice(0, 120);
}

export const Route = createFileRoute("/api/diary/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const q = normalizeSearchTerm(url.searchParams.get("q"));

        try {
          const supabase = getSupabaseAdmin();
          const escaped = q.replace(/[%_]/g, "");
          let query = supabase
            .from("diary_entries")
            .select("id, title, content, entry_date, song_title, song_artist, song_url, created_at")
            .eq("user_id", userId)
            .order("entry_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(24);

          if (escaped) {
            query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
          }

          const { data: entries, error: entriesError } = await query;

          if (entriesError) {
            throw entriesError;
          }

          const entryIds = (entries ?? []).map((row) => Number(row.id));
          let photosByEntryId = new Map<number, string[]>();

          if (entryIds.length > 0) {
            const { data: photos, error: photosError } = await supabase
              .from("entry_photos")
              .select("entry_id, photo_url, created_at")
              .in("entry_id", entryIds)
              .order("created_at", { ascending: false });

            if (photosError) {
              throw photosError;
            }

            photosByEntryId = (photos ?? []).reduce((acc, row) => {
              const key = Number(row.entry_id);
              const current = acc.get(key) ?? [];
              current.push(row.photo_url);
              acc.set(key, current);
              return acc;
            }, new Map<number, string[]>());
          }

          const hydratedEntries = (entries ?? []).map((row) => {
            const photoUrls = photosByEntryId.get(Number(row.id)) ?? [];
            return {
              ...row,
              photo_count: photoUrls.length,
              photo_urls: photoUrls,
            };
          });

          return Response.json({ entries: hydratedEntries, query: q }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Diary search API error", error);
          return Response.json({ message: "No se pudieron buscar las entradas" }, { status: 500 });
        }
      },
    },
  },
});
