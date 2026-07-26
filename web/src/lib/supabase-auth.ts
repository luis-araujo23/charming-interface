import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabase";

export function isAuthEmailConfirmed(user: User | null | undefined) {
  return Boolean(user?.email_confirmed_at);
}

export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === normalizedEmail);
    if (found) {
      return found;
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return null;
}

/**
 * Links public.users.auth_id to the Auth user, unlinking any stale profile that
 * still points at the same auth_id (privacy: one Auth user = one profile).
 */
export async function linkPublicUserAuthId(
  supabase: SupabaseClient,
  email: string,
  authUserId: string,
) {
  const normalizedEmail = email.trim().toLowerCase();

  const { error: unlinkError } = await supabase
    .from("users")
    .update({ auth_id: null })
    .eq("auth_id", authUserId)
    .neq("email", normalizedEmail);

  if (unlinkError) {
    throw unlinkError;
  }

  const { error: linkError } = await supabase
    .from("users")
    .update({ auth_id: authUserId })
    .eq("email", normalizedEmail);

  if (linkError) {
    throw linkError;
  }
}

/**
 * If Auth already confirmed the email but public.users still says false,
 * promote the public flag so web login (bcrypt) and phone stay in sync.
 */
export async function syncPublicEmailConfirmedFromAuth(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const authUser = await findAuthUserByEmail(supabase, normalizedEmail);
  if (!isAuthEmailConfirmed(authUser)) {
    return false;
  }

  const { error } = await supabase
    .from("users")
    .update({ email_confirmed: true })
    .eq("email", normalizedEmail);

  if (error) {
    throw error;
  }

  return true;
}

export type EnsureAuthOptions = {
  /**
   * Only pass true for accounts that are ALREADY allowed to log in
   * (public.users.email_confirmed = true). Never use this to bypass
   * verification for new signups.
   */
  forceConfirm?: boolean;
};

/**
 * Ensures a Supabase Auth user exists, has the given password, and is linked to
 * public.users.auth_id. Used by /api/auth/sync for the phone hybrid flow.
 *
 * IMPORTANT: does NOT auto-confirm unverified emails unless forceConfirm is set
 * (legacy/grandfathered accounts that already passed app-level verification).
 */
export async function ensureSupabaseAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
  username?: string,
  options: EnsureAuthOptions = {},
) {
  const normalizedEmail = email.trim().toLowerCase();
  const forceConfirm = options.forceConfirm === true;

  const { data: createData, error: authCreateError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    user_metadata: username ? { username } : undefined,
    email_confirm: forceConfirm,
  });

  let authUserId = createData?.user?.id ?? null;

  if (authCreateError) {
    const message = authCreateError.message?.toLowerCase() ?? "";
    const alreadyExists =
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("duplicate") ||
      message.includes("exists");

    if (!alreadyExists) {
      throw authCreateError;
    }

    const existing = await findAuthUserByEmail(supabase, normalizedEmail);
    if (!existing) {
      throw authCreateError;
    }

    authUserId = existing.id;

    // Re-sync password. Only force-confirm when the caller explicitly allows it
    // (account already verified at the app level).
    const updatePayload: { password: string; email_confirm?: boolean } = { password };
    if (forceConfirm) {
      updatePayload.email_confirm = true;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, updatePayload);
    if (updateError) {
      throw updateError;
    }
  }

  if (authUserId) {
    await linkPublicUserAuthId(supabase, normalizedEmail, authUserId);
  }

  return authUserId;
}

/**
 * Creates an Auth user WITHOUT confirming email. Does not send mail.
 * Returns the Auth user id.
 */
export async function createUnconfirmedAuthUser(params: {
  email: string;
  password: string;
  username: string;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = params.email.trim().toLowerCase();

  const existing = await findAuthUserByEmail(supabase, normalizedEmail);
  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: params.password,
      email_confirm: false,
      user_metadata: { username: params.username },
    });

    if (error) {
      throw error;
    }

    return data.user?.id ?? null;
  }

  if (isAuthEmailConfirmed(existing)) {
    throw new Error("EMAIL_ALREADY_CONFIRMED");
  }

  // Keep password in sync for retries / re-register attempts that hit Auth first.
  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password: params.password,
    user_metadata: { username: params.username },
  });
  if (updateError) {
    throw updateError;
  }

  return existing.id;
}

/** @deprecated Prefer createUnconfirmedAuthUser + sendSignupConfirmationEmail */
export async function createUnconfirmedAuthUserAndSendEmail(params: {
  email: string;
  password: string;
  username: string;
  emailRedirectTo: string;
}) {
  const authUserId = await createUnconfirmedAuthUser(params);
  await sendSignupConfirmationEmail({
    email: params.email,
    emailRedirectTo: params.emailRedirectTo,
  });
  return authUserId;
}

export function isEmailSendRateLimitError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : JSON.stringify(error ?? "").toLowerCase();

  return (
    message.includes("over_email_send_rate_limit") ||
    message.includes("email rate limit") ||
    message.includes("rate_limit") ||
    message.includes('"code":429') ||
    message.includes("http 429")
  );
}

async function buildEmailConfirmationLink(params: {
  email: string;
  password?: string;
  emailRedirectTo: string;
}) {
  const admin = getSupabaseAdmin();
  const email = params.email.trim().toLowerCase();

  // User already exists after register, so "signup" generateLink usually fails.
  // Prefer magiclink; the landing page will mark Auth + public as confirmed.
  if (params.password) {
    const signup = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: params.password,
      options: { redirectTo: params.emailRedirectTo },
    });
    if (!signup.error && signup.data.properties?.action_link) {
      return signup.data.properties.action_link;
    }
  }

  const magic = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: params.emailRedirectTo },
  });

  if (magic.error || !magic.data.properties?.action_link) {
    throw magic.error ?? new Error("No se pudo generar el enlace de verificación.");
  }

  return magic.data.properties.action_link;
}

function stripEnvQuotes(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function buildConfirmationEmailHtml(actionLink: string) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1f2a1f;">
      <h1 style="font-size: 28px; margin-bottom: 8px;">kitty</h1>
      <p style="font-size: 16px; line-height: 1.5;">Confirma tu correo para activar tu diario.</p>
      <p style="margin: 28px 0;">
        <a href="${actionLink}"
           style="display: inline-block; background: #3d4f3a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px;">
          Verificar mi correo
        </a>
      </p>
      <p style="font-size: 13px; color: #5c6b5c; line-height: 1.5;">
        Si el botón no funciona, copia y pega este enlace en el navegador:<br/>
        <a href="${actionLink}" style="color: #3d4f3a; word-break: break-all;">${actionLink}</a>
      </p>
      <p style="font-size: 12px; color: #7a8a7a;">Si no creaste una cuenta en Kitty, ignora este mensaje.</p>
    </div>
  `;
}

function getValidResendApiKey() {
  const apiKey = stripEnvQuotes(process.env.RESEND_API_KEY);
  if (!apiKey) return null;
  if (!apiKey.startsWith("re_") || apiKey.length < 20) return null;
  return apiKey;
}

function getSmtpConfig() {
  const host = stripEnvQuotes(process.env.SMTP_HOST);
  const user = stripEnvQuotes(process.env.SMTP_USER);
  const pass = stripEnvQuotes(process.env.SMTP_PASS).replace(/\s+/g, "");
  const portRaw = stripEnvQuotes(process.env.SMTP_PORT) || "465";
  const port = Number(portRaw) || 465;

  if (!host && !user && !pass) return null;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP incompleto en Vercel. Necesitas las 3: SMTP_HOST=smtp.gmail.com, SMTP_USER=tu@gmail.com, SMTP_PASS=contraseña de aplicación de 16 letras.",
    );
  }

  if (!host.includes(".")) {
    throw new Error(
      `SMTP_HOST inválido ("${host}"). Debe ser exactamente: smtp.gmail.com`,
    );
  }

  if (!user.includes("@")) {
    throw new Error(
      `SMTP_USER inválido ("${user}"). Debe ser tu Gmail completo, ej: luisalfonsoaraujoleon@gmail.com`,
    );
  }

  // Google app passwords are 16 chars (sometimes shown with spaces).
  if (pass.length < 16) {
    throw new Error(
      `SMTP_PASS parece incompleta (${pass.length} caracteres). Debe ser la contraseña de aplicación de Google (16 letras). No uses tu contraseña normal de Gmail.`,
    );
  }

  return { host, user, pass, port, secure: port === 465 };
}

async function sendConfirmationEmailWithResend(params: {
  email: string;
  actionLink: string;
  apiKey: string;
}) {
  // Resend rejects arbitrary Gmail "from" addresses unless the domain is verified.
  // Use onboarding@resend.dev unless EMAIL_FROM is clearly a custom domain.
  const configuredFrom =
    stripEnvQuotes(process.env.EMAIL_FROM) || stripEnvQuotes(process.env.RESEND_FROM);
  const from =
    configuredFrom &&
    !configuredFrom.toLowerCase().includes("@gmail.com") &&
    !configuredFrom.toLowerCase().includes("@googlemail.com")
      ? configuredFrom
      : "Kitty <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email.trim().toLowerCase()],
      subject: "Verifica tu correo en Kitty",
      html: buildConfirmationEmailHtml(params.actionLink),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const lower = body.toLowerCase();
    if (lower.includes("api key is invalid") || response.status === 401) {
      throw new Error(
        "Resend rechazó la API key (inválida). Usa SMTP_HOST/SMTP_USER/SMTP_PASS (Gmail) o una key Resend válida + dominio verificado.",
      );
    }
    if (
      lower.includes("domain") ||
      lower.includes("from") ||
      lower.includes("not allowed to send") ||
      lower.includes("only send testing")
    ) {
      throw new Error(
        "Resend solo deja enviar a cualquier correo si verificas un dominio. Mientras tanto configura SMTP (Gmail App Password) en Vercel.",
      );
    }
    throw new Error(body ? `Resend no pudo enviar el correo: ${body}` : `Resend error HTTP ${response.status}`);
  }
}

async function sendConfirmationEmailWithSmtp(params: {
  email: string;
  actionLink: string;
}) {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("Falta SMTP_HOST / SMTP_USER / SMTP_PASS.");
  }

  const from =
    stripEnvQuotes(process.env.EMAIL_FROM) ||
    `Kitty <${smtp.user}>`;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from,
    to: params.email.trim().toLowerCase(),
    subject: "Verifica tu correo en Kitty",
    html: buildConfirmationEmailHtml(params.actionLink),
  });
}

/**
 * Sends signup confirmation to ANY email address.
 *
 * Tries SMTP (Gmail) and Resend; uses the first that works.
 * On Vercel, SMTP sockets sometimes fail — Resend HTTP is the reliable fallback
 * (with onboarding@resend.dev it can still reach the Resend account email).
 */
export async function sendSignupConfirmationEmail(params: {
  email: string;
  emailRedirectTo: string;
  /** Helps generateLink(type=signup) when available (register / resend). */
  password?: string;
}) {
  const actionLink = await buildEmailConfirmationLink({
    email: params.email,
    password: params.password,
    emailRedirectTo: params.emailRedirectTo,
  });

  const errors: string[] = [];

  // 1) Prefer Resend over HTTPS (more reliable on Vercel serverless than SMTP sockets).
  const resendKey = getValidResendApiKey();
  if (resendKey) {
    try {
      await sendConfirmationEmailWithResend({
        email: params.email,
        actionLink,
        apiKey: resendKey,
      });
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // 2) SMTP Gmail (works for any recipient if Vercel can open the socket).
  try {
    const smtp = getSmtpConfig();
    if (smtp) {
      await sendConfirmationEmailWithSmtp({
        email: params.email,
        actionLink,
      });
      return;
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  throw new Error(
    errors.length
      ? `No se pudo enviar el correo. Detalles: ${errors.join(" | ")}`
      : "No hay proveedor de correo configurado (SMTP o RESEND_API_KEY).",
  );
}

/** Optional helper if some callers need an anon client later. */
export function getSupabaseAnon(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not configured.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function resolveEmailRedirectTo(request: Request) {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim();

  // On Vercel, prefer the deployment URL when APP_URL is missing so confirmation
  // emails never fall back to localhost in production.
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const vercelOrigin = vercelUrl
    ? vercelUrl.startsWith("http")
      ? vercelUrl.replace(/\/$/, "")
      : `https://${vercelUrl.replace(/\/$/, "")}`
    : null;

  const origin = (configured || vercelOrigin || request.headers.get("origin") || new URL(request.url).origin)
    .replace(/\/$/, "");

  const redirectTo = `${origin}/auth/confirmed`;

  // localhost in the email link only works on the same machine that runs the
  // server — phones will show ERR_CONNECTION_REFUSED. Prefer a public URL.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(origin)) {
    console.warn(
      `[auth] APP_URL es ${origin}. En producción pon APP_URL=https://tu-dominio.vercel.app (y esa URL en Supabase Redirect URLs).`,
    );
  }

  return redirectTo;
}
