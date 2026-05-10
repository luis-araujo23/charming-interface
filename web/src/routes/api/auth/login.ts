import { createFileRoute } from "@tanstack/react-router";
import { compare } from "bcryptjs";
import { buildSessionCookie, createSessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

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
          const db = getDbPool();
          const result = await db.query<{
            id: string | number;
            username: string;
            email: string;
            password_hash: string;
          }>(
            `
              SELECT id, username, email, password_hash
              FROM public.users
              WHERE email = $1
              LIMIT 1
            `,
            [email],
          );

          const user = result.rows[0];

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
          if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
            return Response.json(
              { message: "Falta configurar DATABASE_URL en el archivo .env del proyecto." },
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
