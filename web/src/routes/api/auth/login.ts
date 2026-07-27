import { createFileRoute } from "@tanstack/react-router";
import { compare, hash } from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { buildSessionCookie, createSessionToken } from "@/lib/auth-session";
import { syncPublicEmailConfirmedFromAuth } from "@/lib/supabase-auth";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

async function passwordMatchesAuth(email: string, password: string) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) return false;

  const keys = [
    process.env.SUPABASE_ANON_KEY?.trim(),
    process.env.VITE_SUPABASE_ANON_KEY?.trim(),
    process.env.PUBLIC_SUPABASE_ANON_KEY?.trim(),
    // Last resort: some projects only expose the service role on the server.
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  ].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const client = createClient(supabaseUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      try {
        await client.auth.signOut();
      } catch {
        // ignore
      }
      return true;
    }
  }

  return false;
}

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
            .select("id, username, email, password_hash, email_confirmed")
            .ilike("email", email)
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (userError) {
            throw userError;
          }

          if (!user) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          let matches = false;
          if (typeof user.password_hash === "string" && user.password_hash.length > 0) {
            matches = await compare(password, user.password_hash);
          }

          // Recovery path: confirmation / triggers sometimes leave password_hash empty
          // while Supabase Auth still has the password from register.
          if (!matches) {
            const authOk = await passwordMatchesAuth(user.email, password);
            if (authOk) {
              matches = true;
              try {
                const repairedHash = await hash(password, 12);
                await supabase
                  .from("users")
                  .update({ password_hash: repairedHash })
                  .eq("id", user.id);
              } catch (repairError) {
                console.error("Login password_hash repair failed", repairError);
              }
            }
          }

          if (!matches) {
            return Response.json({ message: "Credenciales inválidas." }, { status: 401 });
          }

          let emailConfirmed = user.email_confirmed === true;

          // User may have just clicked the confirmation link (Auth confirmed)
          // while public.users still has email_confirmed=false. Sync before denying.
          if (!emailConfirmed) {
            try {
              emailConfirmed = await syncPublicEmailConfirmedFromAuth(supabase, user.email);
            } catch (syncError) {
              console.error("Login email-confirm sync error", syncError);
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

          if (error instanceof Error && error.message.includes("AUTH_SESSION_SECRET")) {
            return Response.json(
              {
                message:
                  "Falta AUTH_SESSION_SECRET en el entorno (mínimo 32 caracteres). Configúralo en Vercel antes de iniciar sesión.",
              },
              { status: 500 },
            );
          }

          console.error("Login API error", error);
          return Response.json(
            {
              message:
                error instanceof Error && error.message
                  ? `No se pudo iniciar sesión: ${error.message}`
                  : "No se pudo iniciar sesión",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
