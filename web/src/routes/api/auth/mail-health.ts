import { createFileRoute } from "@tanstack/react-router";
import nodemailer from "nodemailer";

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
 * Optional: ?probe=1 also tries SMTP verify + one Resend API ping.
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
        const probe = new URL(request.url).searchParams.get("probe") === "1";

        const smtpLooksOk =
          host === "smtp.gmail.com" && user.includes("@") && pass.length >= 16 && Boolean(from);

        let smtpVerify: "skipped" | "ok" | "fail" = "skipped";
        let smtpVerifyError: string | null = null;
        let resendPing: "skipped" | "ok" | "fail" = "skipped";
        let resendPingError: string | null = null;

        if (probe && smtpLooksOk) {
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
          } catch (e) {
            smtpVerify = "fail";
            smtpVerifyError = e instanceof Error ? e.message : String(e);
          }
        }

        if (probe && resend.startsWith("re_") && resend.length >= 20) {
          try {
            // domains list is a cheap authenticated ping
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
          },
          resend: {
            keyPresent: Boolean(resend),
            keyLooksValid: resend.startsWith("re_") && resend.length >= 20,
            ping: resendPing,
            pingError: resendPingError,
          },
          appUrlIsHttps: appUrl.startsWith("https://"),
          appUrlLooksLocal:
            /localhost|127\.0\.0\.1|192\.168\./i.test(appUrl) || appUrl.length === 0,
          commitHint: "mail-health-v2-probe",
        };

        return Response.json(body, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
