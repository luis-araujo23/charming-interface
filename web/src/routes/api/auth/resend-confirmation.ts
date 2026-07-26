import { createFileRoute } from "@tanstack/react-router";
import { compare } from "bcryptjs";
import {
  findAuthUserByEmail,
  isAuthEmailConfirmed,
  isEmailSendRateLimitError,
  resolveEmailRedirectTo,
  sendSignupConfirmationEmail,
} from "@/lib/supabase-auth";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type ResendPayload = {
  email?: unknown;
  password?: unknown;
};

/**
 * Resends the signup confirmation email.
 *
 * Requires email + password (same as login) so strangers cannot spam inboxes
 * for arbitrary addresses. If the account is already confirmed, returns 200
 * with alreadyConfirmed=true (no email sent).
 */
export const Route = createFileRoute("/api/auth/resend-confirmation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: ResendPayload;

        try {
          payload = (await request.json()) as ResendPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
        const password = typeof payload.password === "string" ? payload.password : "";

        if (!email || !password) {
          return Response.json(
            { message: "Correo y contraseña son obligatorios para reenviar la verificación." },
            { status: 400 },
          );
        }

        try {
          const supabase = getSupabaseAdmin();
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, email, password_hash, email_confirmed")
            .ilike("email", email)
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (userError) {
            throw userError;
          }

          // Same generic failure as login to avoid account enumeration.
          if (!user || !user.password_hash) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          const matches = await compare(password, user.password_hash);
          if (!matches) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          if (user.email_confirmed === true) {
            return Response.json(
              {
                message: "Tu correo ya está verificado. Puedes iniciar sesión.",
                alreadyConfirmed: true,
              },
              { status: 200 },
            );
          }

          const authUser = await findAuthUserByEmail(supabase, user.email);
          if (isAuthEmailConfirmed(authUser)) {
            await supabase
              .from("users")
              .update({ email_confirmed: true })
              .eq("id", user.id);

            return Response.json(
              {
                message: "Tu correo ya está verificado. Puedes iniciar sesión.",
                alreadyConfirmed: true,
              },
              { status: 200 },
            );
          }

          if (!authUser) {
            return Response.json(
              {
                message:
                  "No encontramos una cuenta pendiente de verificación para ese correo. Regístrate de nuevo.",
                code: "AUTH_USER_MISSING",
              },
              { status: 404 },
            );
          }

          await sendSignupConfirmationEmail({
            email: user.email,
            password,
            emailRedirectTo: resolveEmailRedirectTo(request),
          });

          return Response.json(
            {
              message: "Te reenviamos el correo de verificación. Revisa tu bandeja (y spam).",
              email: user.email,
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

          if (error instanceof Error && error.message.includes("SUPABASE_ANON_KEY")) {
            return Response.json({ message: error.message }, { status: 500 });
          }

          if (isEmailSendRateLimitError(error)) {
            return Response.json(
              {
                message:
                  "Supabase limitó el envío de correos por demasiados intentos. Espera unos minutos (hasta ~1 hora) y vuelve a reenviar.",
                code: "EMAIL_RATE_LIMIT",
              },
              { status: 429 },
            );
          }

          console.error("Resend confirmation API error", error);
          return Response.json(
            {
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "No se pudo reenviar el correo de verificación.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
