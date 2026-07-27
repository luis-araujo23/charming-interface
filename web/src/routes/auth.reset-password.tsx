import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
});

function readAccessTokenFromUrl() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const fromHash = new URLSearchParams(hash).get("access_token");
    if (fromHash) return fromHash;
  }

  return new URLSearchParams(window.location.search).get("access_token");
}

function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = readAccessTokenFromUrl();
    setAccessToken(token);
    setBooting(false);
    if (token) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!accessToken) {
      setError("El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "No se pudo restablecer la contraseña.");
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-olive-deep" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </div>

      <AuthCard
        title={done ? "Contraseña actualizada" : "Nueva contraseña"}
        subtitle={done ? "Ya puedes entrar a tu diario" : "Elige una contraseña segura"}
        footer={
          <>
            <Link to="/login" className="font-medium text-olive-deep underline-offset-4 hover:underline">
              Ir a iniciar sesión
            </Link>
          </>
        }
      >
        {done ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Tu contraseña se guardó correctamente. Úsala en la web o en la app.</p>
            <Button asChild className="h-11 w-full rounded-xl">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </div>
        ) : !accessToken ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Este enlace no es válido o ya se usó. Solicita uno nuevo desde «¿Olvidaste tu
              contraseña?».
            </p>
            <Button asChild className="h-11 w-full rounded-xl">
              <Link to="/forgot-password">Solicitar nuevo enlace</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={onSubmit}>
            <AuthField
              id="password"
              label="Nueva contraseña"
              type="password"
              placeholder="mínimo 8 caracteres"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <AuthField
              id="confirm"
              label="Confirmar contraseña"
              type="password"
              placeholder="repite la contraseña"
              icon={<Lock className="h-4 w-4" />}
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </AuthCard>
    </main>
  );
}
