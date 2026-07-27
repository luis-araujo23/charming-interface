import { createFileRoute } from "@tanstack/react-router";
import {
  findAuthUserByEmail,
  resolvePasswordResetRedirectTo,
  sendPasswordRecoveryEmail,
} from "@/lib/supabase-auth";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type ForgotPayload = {
  email?: unknown;
};

/**
 * Requests a password-reset email.
 * Always returns a generic success message (no account enumeration).
 */
export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: ForgotPayload;

        try {
          payload = (await request.json()) as ForgotPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

        if (!email) {
          return Response.json({ message: "Escribe tu correo." }, { status: 400 });
        }

        const genericMessage =
          "Si ese correo tiene una cuenta en Kitty, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja (y spam).";

        try {
          const supabase = getSupabaseAdmin();
          const { data: publicUser, error: publicError } = await supabase
            .from("users")
            .select("id, email, email_confirmed")
            .ilike("email", email)
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (publicError) {
            throw publicError;
          }

          // Only send when the public account exists and is verified.
          if (publicUser && publicUser.email_confirmed === true) {
            const authUser = await findAuthUserByEmail(supabase, email);
            if (authUser) {
              const sent = await sendPasswordRecoveryEmail({
                email,
                emailRedirectTo: resolvePasswordResetRedirectTo(request),
              });
              if (!sent.emailSent) {
                console.error("Forgot-password send failed", sent.sendErrors);
                return Response.json(
                  {
                    message:
                      sent.sendErrors.join(" | ") ||
                      "No pudimos enviar el correo ahora. Intenta de nuevo en unos minutos.",
                  },
                  { status: 500 },
                );
              }
            }
          }

          return Response.json({ message: genericMessage, email }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              {
                message:
                  "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env.",
              },
              { status: 500 },
            );
          }

          console.error("Forgot-password API error", error);
          return Response.json(
            {
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "No se pudo procesar la solicitud.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
