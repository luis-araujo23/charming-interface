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

export const Route = createFileRoute("/api/friends")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        try {
          const supabase = getSupabaseAdmin();

          const { data: pendingRows, error: pendingError } = await supabase
            .from("friendships")
            .select("id, requester_id")
            .eq("addressee_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

          if (pendingError) {
            throw pendingError;
          }

          const { data: outgoingRows, error: outgoingError } = await supabase
            .from("friendships")
            .select("id, addressee_id")
            .eq("requester_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false });

          if (outgoingError) {
            throw outgoingError;
          }

          const { data: acceptedRows, error: acceptedError } = await supabase
            .from("friendships")
            .select("id, requester_id, addressee_id")
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .eq("status", "accepted");

          if (acceptedError) {
            throw acceptedError;
          }

          const userIds = new Set<number>();
          for (const row of pendingRows ?? []) {
            userIds.add(Number(row.requester_id));
          }
          for (const row of outgoingRows ?? []) {
            userIds.add(Number(row.addressee_id));
          }
          for (const row of acceptedRows ?? []) {
            const requesterId = Number(row.requester_id);
            const addresseeId = Number(row.addressee_id);
            userIds.add(requesterId === userId ? addresseeId : requesterId);
          }

          let usersById = new Map<number, { id: number; username: string }>();
          if (userIds.size > 0) {
            const { data: usersRows, error: usersError } = await supabase
              .from("users")
              .select("id, username")
              .in("id", [...userIds]);

            if (usersError) {
              throw usersError;
            }

            usersById = new Map((usersRows ?? []).map((row) => [Number(row.id), { id: Number(row.id), username: row.username }]));
          }

          const pendingRequests = (pendingRows ?? [])
            .map((row) => {
              const target = usersById.get(Number(row.requester_id));
              if (!target) {
                return null;
              }

              return {
                friendshipId: Number(row.id),
                userId: target.id,
                username: target.username,
              };
            })
            .filter(Boolean);

          const outgoingPendingRequests = (outgoingRows ?? [])
            .map((row) => {
              const target = usersById.get(Number(row.addressee_id));
              if (!target) {
                return null;
              }

              return {
                friendshipId: Number(row.id),
                userId: target.id,
                username: target.username,
              };
            })
            .filter(Boolean);

          const friends = (acceptedRows ?? [])
            .map((row) => {
              const requesterId = Number(row.requester_id);
              const addresseeId = Number(row.addressee_id);
              const friendId = requesterId === userId ? addresseeId : requesterId;
              const target = usersById.get(friendId);

              if (!target) {
                return null;
              }

              return {
                friendshipId: Number(row.id),
                userId: target.id,
                username: target.username,
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.username.localeCompare(b.username));

          return Response.json(
            {
              pendingRequests,
              outgoingPendingRequests,
              friends,
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

          console.error("Friends list API error", error);
          return Response.json({ message: "No se pudo cargar la lista de amigos" }, { status: 500 });
        }
      },
    },
  },
});