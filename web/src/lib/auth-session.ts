import { createHmac } from "node:crypto";

export const SESSION_COOKIE_NAME = "charming_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  username: string;
  email: string;
  exp: number;
};

type SessionUser = {
  userId: string;
  username: string;
  email: string;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.SESSION_SECRET;

  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  if (isProduction()) {
    throw new Error(
      "AUTH_SESSION_SECRET must be set to a random string of at least 32 characters in production.",
    );
  }

  // Local dev only — never used on Vercel if AUTH_SESSION_SECRET is configured.
  return "dev-auth-secret-change-me-local-only";
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

export function parseCookies(cookieHeader: string | null) {
  if (!cookieHeader) {
    return {} as Record<string, string>;
  }

  const entries = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      return [key, decodeURIComponent(value)] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return Object.fromEntries(entries);
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + SESSION_DURATION_SECONDS * 1000,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || signature !== sign(encodedPayload)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

    if (!payload.userId || !payload.username || !payload.email || !payload.exp) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function cookieFlags() {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (isProduction()) {
    flags.push("Secure");
  }
  return flags.join("; ");
}

export function buildSessionCookie(token: string) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_DURATION_SECONDS}; ${cookieFlags()}`;
}

export function buildSessionClearCookie() {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; ${cookieFlags()}`;
}
