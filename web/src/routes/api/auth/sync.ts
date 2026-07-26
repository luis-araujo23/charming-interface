import { createFileRoute } from "@tanstack/react-router";
import { compare } from "bcryptjs";
import {
  ensureSupabaseAuthUser,
  syncPublicEmailConfirmedFromAuth,
} from "@/lib/supabase-auth";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type SyncPayload = {
  email?: unknown;
  password?: unknown;
};

/**
 * Phone hybrid bridge: after the user is verified and password matches
 * public.users, ensure a Supabase Auth user exists (confirmed) and auth_id is
 * linked so RLS/RPCs work.
 *
 * NEVER force-confirms unverified accounts — that was the old bypass.
 */
export const Route = createFileRoute("/api/auth/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: SyncPayload;

        try {
          payload = (await request.json()) as SyncPayload;
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
            .select("username, email, password_hash, email_confirmed")
            .ilike("email", email)
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (userError) {
            throw userError;
          }

          if (!user || !user.password_hash) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          const passwordMatches = await compare(password, user.password_hash);
          if (!passwordMatches) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          let emailConfirmed = user.email_confirmed === true;
          if (!emailConfirmed) {
            try {
              emailConfirmed = await syncPublicEmailConfirmedFromAuth(supabase, user.email);
            } catch (syncError) {
              console.error("Sync email-confirm check error", syncError);
            }
          }

          if (!emailConfirmed) {
            return Response.json(
              {
                message:
                  "Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada (y spam).",
                code: "EMAIL_NOT_CONFIRMED",
                email: user.email,
              },
              { status: 403 },
            );
          }

          // Account is verified at app level → Auth user may be created/confirmed.
          await ensureSupabaseAuthUser(supabase, user.email, password, user.username, {
            forceConfirm: true,
          });

          return Response.json({ message: "Cuenta sincronizada con Supabase Auth." }, { status: 200 });
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Auth sync API error", error);
          return Response.json({ message: "No se pudo sincronizar la cuenta." }, { status: 500 });
        }
      },
    },
  },
});
