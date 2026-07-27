import { createFileRoute } from "@tanstack/react-router";
import { hash } from "bcryptjs";
import {
  createUnconfirmedAuthUser,
  isEmailSendRateLimitError,
  linkPublicUserAuthId,
  resolveEmailRedirectTo,
  sendSignupConfirmationEmail,
} from "@/lib/supabase-auth";
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
        const emailRedirectTo = resolveEmailRedirectTo(request);

        try {
          const supabase = getSupabaseAdmin();

          // Pre-check: clearer message than a raw unique violation.
          const [{ data: byEmail }, { data: byUsername }] = await Promise.all([
            supabase
              .from("users")
              .select("id, email, username, email_confirmed")
              .ilike("email", email)
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("users")
              .select("id, email, username, email_confirmed")
              .ilike("username", username)
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle(),
          ]);

          const unconfirmedPayload = async () => {
            try {
              const sent = await sendSignupConfirmationEmail({
                email,
                password,
                emailRedirectTo,
              });
              return {
                message: sent.emailSent
                  ? "Tu cuenta ya está creada, pero el correo aún no está verificado. Revisa tu bandeja (y spam) o reenvía el correo desde Iniciar sesión."
                  : "Tu cuenta ya está creada, pero no pudimos enviar el correo. En Iniciar sesión usa «Reenviar correo de verificación».",
                code: "EMAIL_NOT_CONFIRMED" as const,
                email,
                needsEmailConfirmation: true,
                emailSent: sent.emailSent,
                mailProvider: sent.provider,
              };
            } catch {
              return {
                message:
                  "Tu cuenta ya está creada, pero aún no está verificada. En Iniciar sesión usa «Reenviar correo de verificación».",
                code: "EMAIL_NOT_CONFIRMED" as const,
                email,
                needsEmailConfirmation: true,
              };
            }
          };

          // Same person retrying register after a successful create (common when
          // the confirmation email was slow / buried in spam).
          if (
            byUsername &&
            byEmail &&
            byUsername.id === byEmail.id &&
            byEmail.email_confirmed === false
          ) {
            return Response.json(await unconfirmedPayload(), { status: 409 });
          }

          if (byUsername) {
            // Username taken by this same email (partial match race) or another account.
            if (
              byUsername.email_confirmed === false &&
              typeof byUsername.email === "string" &&
              byUsername.email.toLowerCase() === email
            ) {
              return Response.json(await unconfirmedPayload(), { status: 409 });
            }

            return Response.json(
              {
                message: `El nombre de usuario «${username}» ya está en uso. Elige otro.`,
                code: "USERNAME_TAKEN",
              },
              { status: 409 },
            );
          }

          if (byEmail) {
            if (byEmail.email_confirmed === false) {
              return Response.json(await unconfirmedPayload(), { status: 409 });
            }

            return Response.json(
              {
                message: "Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.",
                code: "EMAIL_TAKEN",
              },
              { status: 409 },
            );
          }

          // 1) Auth user UNCONFIRMED (no email yet — so rate-limit won't leave orphans half-created).
          let authUserId: string | null = null;
          try {
            authUserId = await createUnconfirmedAuthUser({
              email,
              password,
              username,
            });
          } catch (authError) {
            if (authError instanceof Error && authError.message === "EMAIL_ALREADY_CONFIRMED") {
              return Response.json(
                {
                  message: "Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.",
                  code: "EMAIL_TAKEN",
                },
                { status: 409 },
              );
            }
            throw authError;
          }

          // 2) public.users row (app identity + bcrypt for web login).
          const { data: createdUser, error: createError } = await supabase
            .from("users")
            .insert({
              username,
              email,
              password_hash: passwordHash,
              email_confirmed: false,
              auth_id: authUserId,
            })
            .select("id, username, email, created_at, email_confirmed, password_hash, auth_id")
            .single();

          if (createError) {
            // Roll back Auth user to avoid orphan unconfirmed accounts.
            if (authUserId) {
              try {
                await supabase.auth.admin.deleteUser(authUserId);
              } catch (rollbackError) {
                console.error("Register rollback (delete Auth user) failed", rollbackError);
              }
            }
            throw createError;
          }

          // Some DB triggers/hooks clear password_hash after insert — re-assert it.
          if (!createdUser.password_hash) {
            const { error: hashRepairError } = await supabase
              .from("users")
              .update({ password_hash: passwordHash })
              .eq("id", createdUser.id);
            if (hashRepairError) {
              console.error("Register password_hash repair failed", hashRepairError);
            }
          }

          if (authUserId && !createdUser.auth_id) {
            await linkPublicUserAuthId(supabase, email, authUserId);
          }

          // 3) Send confirmation email only (verification must happen via that email).
          let emailSent = false;
          let emailRateLimited = false;
          let mailProvider: string | null = null;
          let message =
            "Cuenta creada. Te enviamos un correo para verificar tu cuenta. Confírmalo antes de iniciar sesión.";

          try {
            const sent = await sendSignupConfirmationEmail({
              email,
              password,
              emailRedirectTo,
            });
            emailSent = sent.emailSent;
            mailProvider = sent.provider;
            console.info("Register confirmation prepared", {
              emailSent: sent.emailSent,
              provider: sent.provider,
              sendErrors: sent.sendErrors,
            });
            if (!sent.emailSent) {
              message = sent.sendErrors.some(isEmailSendRateLimitError)
                ? "Cuenta creada, pero se limitó el envío de correos. Espera unos minutos y en Iniciar sesión usa «Reenviar correo de verificación»."
                : `Cuenta creada, pero no pudimos enviar el correo: ${sent.sendErrors.join(" | ") || "error desconocido"}`;
              emailRateLimited = sent.sendErrors.some(isEmailSendRateLimitError);
            }
          } catch (sendError) {
            if (isEmailSendRateLimitError(sendError)) {
              emailRateLimited = true;
              message =
                "Cuenta creada, pero se limitó el envío. En Iniciar sesión usa «Reenviar correo de verificación».";
            } else {
              message =
                sendError instanceof Error && sendError.message
                  ? `Cuenta creada, pero no pudimos enviar el correo: ${sendError.message}`
                  : "Cuenta creada, pero no pudimos enviar el correo de verificación.";
              console.error("Register email send error", sendError);
            }
          }

          // generateLink / Auth hooks can wipe password_hash — restore before responding.
          await supabase
            .from("users")
            .update({ password_hash: passwordHash })
            .eq("id", createdUser.id);

          return Response.json(
            {
              message,
              needsEmailConfirmation: true,
              emailSent,
              emailRateLimited,
              mailProvider,
              email,
              user: {
                id: createdUser.id,
                username: createdUser.username,
                email: createdUser.email,
              },
            },
            { status: 201 },
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
                  "Supabase limitó el envío de correos por demasiados intentos. Espera unos minutos (hasta ~1 hora) o prueba con otro correo.",
                code: "EMAIL_RATE_LIMIT",
              },
              { status: 429 },
            );
          }

          if (getErrorCode(error) === "23505") {
            const details = String(
              (error as { details?: string; message?: string }).details ??
                (error as { message?: string }).message ??
                "",
            ).toLowerCase();
            if (details.includes("username")) {
              return Response.json(
                {
                  message: `El nombre de usuario «${username}» ya está en uso. Elige otro.`,
                  code: "USERNAME_TAKEN",
                },
                { status: 409 },
              );
            }
            if (details.includes("email")) {
              return Response.json(
                {
                  message: "Ese correo ya está registrado. Inicia sesión o recupera tu contraseña.",
                  code: "EMAIL_TAKEN",
                },
                { status: 409 },
              );
            }
            return Response.json(
              { message: "Ese usuario o correo ya está registrado.", code: "CONFLICT" },
              { status: 409 },
            );
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
                  "La tabla users requiere columnas adicionales sin valor por defecto. Ejecuta sql/2026-07-16_email_confirmation.sql y vuelve a intentar.",
              },
              { status: 500 },
            );
          }

          console.error("Register API error", error);
          return Response.json(
            {
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "No se pudo crear la cuenta",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
