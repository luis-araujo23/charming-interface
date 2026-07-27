import { createFileRoute } from "@tanstack/react-router";
import { hash } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

type ResetPayload = {
  access_token?: unknown;
  password?: unknown;
};

/**
 * Completes password reset after the user clicks the email recovery link.
 * Updates both Supabase Auth password and public.users.password_hash.
 */
export const Route = createFileRoute("/api/auth/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: ResetPayload;

        try {
          payload = (await request.json()) as ResetPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const accessToken =
          typeof payload.access_token === "string" ? payload.access_token.trim() : "";
        const password = typeof payload.password === "string" ? payload.password : "";

        if (!accessToken) {
          return Response.json(
            { message: "Falta el token de recuperación. Abre el enlace del correo otra vez." },
            { status: 400 },
          );
        }

        if (!password || password.length < MIN_PASSWORD_LENGTH) {
          return Response.json(
            { message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
            { status: 400 },
          );
        }

        try {
          const supabaseUrl = process.env.SUPABASE_URL?.trim();
          const anonKey =
            process.env.SUPABASE_ANON_KEY?.trim() ||
            process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
            process.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

          if (!supabaseUrl || !anonKey) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY." },
              { status: 500 },
            );
          }

          const anon = createClient(supabaseUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data, error } = await anon.auth.getUser(accessToken);
          if (error || !data.user?.email || !data.user.id) {
            return Response.json(
              { message: "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo." },
              { status: 401 },
            );
          }

          const email = data.user.email.trim().toLowerCase();
          const admin = getSupabaseAdmin();

          const { error: authUpdateError } = await admin.auth.admin.updateUserById(data.user.id, {
            password,
          });
          if (authUpdateError) {
            throw authUpdateError;
          }

          const passwordHash = await hash(password, 12);
          const { error: publicUpdateError } = await admin
            .from("users")
            .update({ password_hash: passwordHash })
            .ilike("email", email);

          if (publicUpdateError) {
            throw publicUpdateError;
          }

          return Response.json(
            {
              message: "Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.",
              email,
            },
            { status: 200 },
          );
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY." },
              { status: 500 },
            );
          }

          console.error("Reset-password API error", error);
          return Response.json(
            {
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "No se pudo restablecer la contraseña.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
