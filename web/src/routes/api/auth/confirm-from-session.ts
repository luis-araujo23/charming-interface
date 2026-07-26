import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type ConfirmPayload = {
  access_token?: unknown;
};

/**
 * After the user clicks the email link, Auth redirects here with
 * #access_token=... . We accept a valid session token and mark both
 * Auth + public.users as confirmed (works for Resend magic links too).
 */
export const Route = createFileRoute("/api/auth/confirm-from-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: ConfirmPayload;

        try {
          payload = (await request.json()) as ConfirmPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const accessToken =
          typeof payload.access_token === "string" ? payload.access_token.trim() : "";

        if (!accessToken) {
          return Response.json({ message: "Falta access_token." }, { status: 400 });
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
              { message: "El enlace de verificación no es válido o ya expiró." },
              { status: 401 },
            );
          }

          const email = data.user.email.trim().toLowerCase();
          const admin = getSupabaseAdmin();

          // Clicking our email link is enough proof — force Auth confirm if needed.
          if (!data.user.email_confirmed_at) {
            const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, {
              email_confirm: true,
            });
            if (confirmError) {
              throw confirmError;
            }
          }

          const { error: updateError } = await admin
            .from("users")
            .update({ email_confirmed: true })
            .eq("email", email);

          if (updateError) {
            throw updateError;
          }

          return Response.json(
            {
              message: "Correo verificado. Ya puedes iniciar sesión.",
              confirmed: true,
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

          console.error("confirm-from-session error", error);
          return Response.json(
            { message: "No se pudo confirmar el correo." },
            { status: 500 },
          );
        }
      },
    },
  },
});
