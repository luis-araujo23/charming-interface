import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/auth/confirmed")({
  component: AuthConfirmedPage,
});

function readAccessTokenFromUrl() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const fromHash = new URLSearchParams(hash).get("access_token");
    if (fromHash) return fromHash;
  }

  // Some Supabase configs put tokens in the query string instead of the hash.
  return new URLSearchParams(window.location.search).get("access_token");
}

/**
 * Landing page after the user clicks the Supabase confirmation link.
 * Supabase confirms auth.users first, then redirects here.
 * Login also syncs public.users.email_confirmed if Auth is already confirmed.
 */
function AuthConfirmedPage() {
  const [status, setStatus] = useState<"idle" | "syncing" | "ok" | "hint" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const token = readAccessTokenFromUrl();
    if (!token) {
      // Visiting /auth/confirmed without a token is not proof of verification.
      setStatus("hint");
      setDetail(
        "Si acabas de hacer clic en el correo de verificación, ya puedes intentar iniciar sesión. Si aún no verificaste, revisa tu bandeja (y spam) o reenvía el correo desde Iniciar sesión.",
      );
      return;
    }

    let cancelled = false;
    setStatus("syncing");

    void (async () => {
      try {
        const res = await fetch("/api/auth/confirm-from-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setDetail(
            typeof data?.message === "string"
              ? data.message
              : "No pudimos sincronizar la verificación. Prueba iniciar sesión de todas formas.",
          );
          return;
        }

        setStatus("ok");
        window.history.replaceState(null, "", window.location.pathname);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setDetail("No pudimos sincronizar la verificación. Prueba iniciar sesión de todas formas.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const title =
    status === "error" ? "Casi listo" : status === "hint" ? "Verificación de correo" : "Correo verificado";

  const subtitle =
    status === "ok"
      ? "Tu cuenta de Kitty ya está lista"
      : status === "hint"
        ? "Último paso para entrar a tu diario"
        : "Tu cuenta de Kitty";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </div>

      <AuthCard
        title={title}
        subtitle={subtitle}
        footer={
          <>
            ¿Problemas para entrar?{" "}
            <Link to="/login" className="font-medium text-olive-deep underline-offset-4 hover:underline">
              Vuelve al inicio de sesión
            </Link>
          </>
        }
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint/30">
            {status === "syncing" ? (
              <Loader2 className="h-7 w-7 animate-spin text-olive-deep" />
            ) : status === "hint" ? (
              <Mail className="h-7 w-7 text-olive-deep" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-olive-deep" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "syncing"
              ? "Confirmando tu correo…"
              : status === "ok"
                ? "Gracias por confirmar tu correo. Ya puedes iniciar sesión en la web o en la app con tu email y contraseña."
                : detail}
          </p>
          <Button asChild className="h-11 w-full rounded-xl" disabled={status === "syncing"}>
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </AuthCard>
    </main>
  );
}
