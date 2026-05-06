import { createFileRoute } from "@tanstack/react-router";
import { compare } from "bcryptjs";
import { buildSessionCookie, createSessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: LoginPayload;

        try {
          payload = (await request.json()) as LoginPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        const password = typeof payload.password === "string" ? payload.password : "";

        if (!email || !password) {
          return Response.json({ message: "Correo y contraseña son obligatorios." }, { status: 400 });
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, username, email, password_hash")
            .ilike("email", email)
            .limit(1)
            .maybeSingle();

          if (userError) {
            throw userError;
          }

          if (!user) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          const matches = await compare(password, user.password_hash);

          if (!matches) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          const token = createSessionToken({
            userId: String(user.id),
            username: user.username,
            email: user.email,
          });

          return new Response(
            JSON.stringify({
              message: "Inicio de sesión correcto",
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Set-Cookie": buildSessionCookie(token),
              },
            },
          );
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Login API error", error);
          return Response.json({ message: "No se pudo iniciar sesión" }, { status: 500 });
        }
      },
    },
  },
});
