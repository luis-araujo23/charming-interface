import { createFileRoute } from "@tanstack/react-router";
import { buildSessionClearCookie } from "@/lib/auth-session";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(JSON.stringify({ message: "Sesión cerrada" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": buildSessionClearCookie(),
          },
        });
      },
    },
  },
});
