import { createFileRoute } from "@tanstack/react-router";
import { hash } from "bcryptjs";
import { buildSessionCookie, createSessionToken } from "@/lib/auth-session";
import { getErrorCode, getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

type RegisterPayload = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

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
          const supabase = getSupabaseAdmin();
          const { data: createdUser, error: createError } = await supabase
            .from("users")
            .insert({
              username,
              email,
              password_hash: passwordHash,
            })
            .select("id, username, email, created_at")
            .single();

          if (createError) {
            throw createError;
          }

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
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
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
