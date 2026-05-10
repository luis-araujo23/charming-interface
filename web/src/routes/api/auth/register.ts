import { createFileRoute } from "@tanstack/react-router";
import { hash } from "bcryptjs";
import type { DatabaseError } from "pg";
import { buildSessionCookie, createSessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";

const MIN_PASSWORD_LENGTH = 8;

type RegisterPayload = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

function getErrorCode(error: unknown) {
  return (error as DatabaseError | undefined)?.code;
}

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: RegisterPayload;

        try {
          payload = (await request.json()) as RegisterPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const username = typeof payload.username === "string" ? payload.username.trim() : "";
        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        const password = typeof payload.password === "string" ? payload.password : "";

        if (!username || !email || !password) {
          return Response.json({ message: "Completa usuario, correo y contraseña." }, { status: 400 });
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          return Response.json(
            { message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
            { status: 400 },
          );
        }

        const passwordHash = await hash(password, 12);

        try {
          const db = getDbPool();
          const result = await db.query<{
            id: string | number;
            username: string;
            email: string;
            created_at: string;
          }>(
            `
              INSERT INTO public.users (username, email, password_hash)
              VALUES ($1, $2, $3)
              RETURNING id, username, email, created_at
            `,
            [username, email, passwordHash],
          );

          const createdUser = result.rows[0];
          const token = createSessionToken({
            userId: String(createdUser.id),
            username: createdUser.username,
            email: createdUser.email,
          });

          return new Response(
            JSON.stringify({
              message: "Cuenta creada correctamente",
              user: createdUser,
            }),
            {
              status: 201,
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

          if (getErrorCode(error) === "23505") {
            return Response.json({ message: "El usuario o correo ya existe." }, { status: 409 });
          }

          if (getErrorCode(error) === "428C9") {
            return Response.json(
              {
                message:
                  "Tu esquema tiene columnas generadas. El endpoint ya fue ajustado, reinicia el servidor y vuelve a intentar.",
              },
              { status: 500 },
            );
          }

          if (getErrorCode(error) === "23502") {
            return Response.json(
              {
                message:
                  "La tabla users requiere columnas adicionales sin valor por defecto. Ajusta defaults en la base de datos o añade esas columnas al INSERT.",
              },
              { status: 500 },
            );
          }

          console.error("Register API error", error);
          return Response.json({ message: "No se pudo crear la cuenta" }, { status: 500 });
        }
      },
    },
  },
});
