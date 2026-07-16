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

export const Route = createFileRoute("/api/friends/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").trim();

        if (query.length < 2) {
          return Response.json({ results: [] }, { status: 200 });
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("users")
            .select("id, username, email")
            .ilike("username", `%${query}%`)
            .neq("id", userId)
            .order("username", { ascending: true })
            .limit(8);

          if (error) {
            throw error;
          }

          const results = (data ?? []).map((row) => ({
            userId: Number(row.id),
            username: row.username as string,
            email: (row.email as string | null) ?? null,
          }));

          return Response.json({ results }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Friends search API error", error);
          return Response.json({ message: "No se pudo buscar usuarios" }, { status: 500 });
        }
      },
    },
  },
});
