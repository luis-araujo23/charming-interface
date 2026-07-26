import { createFileRoute } from "@tanstack/react-router";

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
 */
export const Route = createFileRoute("/api/auth/mail-health")({
  server: {
    handlers: {
      GET: async () => {
        const host = strip(process.env.SMTP_HOST);
        const user = strip(process.env.SMTP_USER);
        const pass = strip(process.env.SMTP_PASS).replace(/\s+/g, "");
        const port = strip(process.env.SMTP_PORT) || "465";
        const from = strip(process.env.EMAIL_FROM);
        const appUrl = strip(process.env.APP_URL);
        const resend = strip(process.env.RESEND_API_KEY);

        const body = {
          ok:
            host === "smtp.gmail.com" &&
            user.includes("@") &&
            pass.length >= 16 &&
            Boolean(from),
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
          },
          appUrlIsHttps: appUrl.startsWith("https://"),
          appUrlLooksLocal:
            /localhost|127\.0\.0\.1|192\.168\./i.test(appUrl) || appUrl.length === 0,
          resendKeyPresent: Boolean(resend),
          resendKeyLooksValid: resend.startsWith("re_") && resend.length >= 20,
          commitHint: "mail-health-v1",
        };

        return Response.json(body, {
          status: body.ok ? 200 : 503,
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
