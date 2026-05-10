import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cookies = parseCookies(request.headers.get("cookie"));
        const token = cookies[SESSION_COOKIE_NAME];

        if (!token) {
          return Response.json({ authenticated: false }, { status: 401 });
        }

        const session = verifySessionToken(token);

        if (!session) {
          return Response.json({ authenticated: false }, { status: 401 });
        }

        return Response.json(
          {
            authenticated: true,
            user: {
              id: session.userId,
              username: session.username,
              email: session.email,
            },
          },
          { status: 200 },
        );
      },
    },
  },
});
