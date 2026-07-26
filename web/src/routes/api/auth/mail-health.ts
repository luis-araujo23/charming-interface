import { createFileRoute } from "@tanstack/react-router";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase";

function strip(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Public health check for mail config (no secrets).
 * GET /api/auth/mail-health
 * Optional: ?probe=1 SMTP verify + Resend ping
 * Optional: ?sendSelf=1 also sends a real test email TO SMTP_USER (proves delivery path)
 */
export const Route = createFileRoute("/api/auth/mail-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = strip(process.env.SMTP_HOST);
        const user = strip(process.env.SMTP_USER);
        const pass = strip(process.env.SMTP_PASS).replace(/\s+/g, "");
        const port = strip(process.env.SMTP_PORT) || "465";
        const from = strip(process.env.EMAIL_FROM);
        const appUrl = strip(process.env.APP_URL);
        const resend = strip(process.env.RESEND_API_KEY);
        const url = new URL(request.url);
        const probe = url.searchParams.get("probe") === "1";
        const sendSelf = url.searchParams.get("sendSelf") === "1";

        const smtpLooksOk =
          host === "smtp.gmail.com" && user.includes("@") && pass.length >= 16 && Boolean(from);

        let smtpVerify: "skipped" | "ok" | "fail" = "skipped";
        let smtpVerifyError: string | null = null;
        let resendPing: "skipped" | "ok" | "fail" = "skipped";
        let resendPingError: string | null = null;
        let smtpSend: "skipped" | "ok" | "fail" = "skipped";
        let smtpSendError: string | null = null;
        let smtpMessageId: string | null = null;
        let resendSend: "skipped" | "ok" | "fail" = "skipped";
        let resendSendError: string | null = null;
        let resendId: string | null = null;
        let generateLink: "skipped" | "ok" | "fail" = "skipped";
        let generateLinkError: string | null = null;

        if ((probe || sendSelf) && smtpLooksOk) {
          try {
            const transporter = nodemailer.createTransport({
              host,
              port: Number(port) || 465,
              secure: Number(port) === 465,
              auth: { user, pass },
              connectionTimeout: 10000,
              greetingTimeout: 10000,
              socketTimeout: 10000,
            });
            await transporter.verify();
            smtpVerify = "ok";

            if (sendSelf) {
              try {
                const info = await transporter.sendMail({
                  from: from || `Kitty <${user}>`,
                  to: user,
                  subject: `Kitty SMTP self-test ${new Date().toISOString()}`,
                  html: "<p>Prueba real desde Vercel. Si llega a la bandeja de <b>kitty.diaryapp</b>, SMTP funciona.</p>",
                });
                smtpSend = "ok";
                smtpMessageId = typeof info.messageId === "string" ? info.messageId : null;
              } catch (e) {
                smtpSend = "fail";
                smtpSendError = e instanceof Error ? e.message : String(e);
              }
            }
          } catch (e) {
            smtpVerify = "fail";
            smtpVerifyError = e instanceof Error ? e.message : String(e);
          }
        }

        if ((probe || sendSelf) && resend.startsWith("re_") && resend.length >= 20) {
          try {
            const r = await fetch("https://api.resend.com/domains", {
              headers: { Authorization: `Bearer ${resend}` },
            });
            if (r.ok) {
              resendPing = "ok";
            } else {
              resendPing = "fail";
              resendPingError = `HTTP ${r.status}`;
            }
          } catch (e) {
            resendPing = "fail";
            resendPingError = e instanceof Error ? e.message : String(e);
          }

          if (sendSelf && user.includes("@")) {
            try {
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resend}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Kitty <onboarding@resend.dev>",
                  to: [user],
                  subject: `Kitty Resend self-test ${new Date().toISOString()}`,
                  html: "<p>Prueba Resend desde Vercel hacia SMTP_USER.</p>",
                }),
              });
              const bodyText = await r.text().catch(() => "");
              if (r.ok) {
                resendSend = "ok";
                try {
                  resendId = (JSON.parse(bodyText) as { id?: string }).id ?? null;
                } catch {
                  resendId = null;
                }
              } else {
                resendSend = "fail";
                resendSendError = bodyText.slice(0, 240) || `HTTP ${r.status}`;
              }
            } catch (e) {
              resendSend = "fail";
              resendSendError = e instanceof Error ? e.message : String(e);
            }
          }
        }

        if (sendSelf) {
          try {
            const admin = getSupabaseAdmin();
            const redirectTo = `${(appUrl || "https://kitty-azure-one.vercel.app").replace(/\/$/, "")}/auth/confirmed`;
            // Pick any existing Auth user so we test link generation (not invent a fake email).
            const { data: listed, error: listError } = await admin.auth.admin.listUsers({
              page: 1,
              perPage: 5,
            });
            if (listError) {
              generateLink = "fail";
              generateLinkError = listError.message;
            } else {
              const sampleEmail = listed.users.find((u) => u.email)?.email;
              if (!sampleEmail) {
                generateLink = "fail";
                generateLinkError = "no_auth_users";
              } else {
                const magic = await admin.auth.admin.generateLink({
                  type: "magiclink",
                  email: sampleEmail,
                  options: { redirectTo },
                });
                if (magic.error || !magic.data.properties?.action_link) {
                  generateLink = "fail";
                  generateLinkError = magic.error?.message ?? "no action_link";
                } else {
                  generateLink = "ok";
                }
              }
            }
          } catch (e) {
            generateLink = "fail";
            generateLinkError = e instanceof Error ? e.message : String(e);
          }
        }

        const body = {
          ok: smtpLooksOk || (resend.startsWith("re_") && resend.length >= 20),
          smtp: {
            hostIsGmail: host === "smtp.gmail.com",
            hostLength: host.length,
            port,
            userHasAt: user.includes("@"),
            userEndsWithGmail: user.toLowerCase().endsWith("@gmail.com"),
            userLength: user.length,
            passLength: pass.length,
            passLengthOk: pass.length >= 16,
            fromSet: Boolean(from),
            fromHasAt: from.includes("@"),
            verify: smtpVerify,
            verifyError: smtpVerifyError,
            send: smtpSend,
            sendError: smtpSendError,
            messageId: smtpMessageId,
          },
          resend: {
            keyPresent: Boolean(resend),
            keyLooksValid: resend.startsWith("re_") && resend.length >= 20,
            ping: resendPing,
            pingError: resendPingError,
            send: resendSend,
            sendError: resendSendError,
            id: resendId,
          },
          generateLink: {
            status: generateLink,
            error: generateLinkError,
          },
          appUrlIsHttps: appUrl.startsWith("https://"),
          appUrlLooksLocal:
            /localhost|127\.0\.0\.1|192\.168\./i.test(appUrl) || appUrl.length === 0,
          commitHint: "mail-health-v3-sendself",
          note: sendSelf
            ? "Revisa la bandeja de kitty.diaryapp@gmail.com (SMTP_USER), no tu correo personal."
            : undefined,
        };

        return Response.json(body, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});