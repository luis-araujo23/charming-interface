import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          await navigate({ to: "/diary" });
          return;
        }
      } catch {
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password.trim()) {
      setError("Completa correo y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "No se pudo iniciar sesión");
      }

      await navigate({ to: "/diary" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <p className="text-sm text-muted-foreground">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8">
        <Link to="/"><Logo size="md" /></Link>
      </div>

      <AuthCard
        title="Bienvenido de vuelta"
        subtitle="Sigue donde lo dejaste"
        footer={
          <>
            ¿Aún no tienes cuenta?{" "}
            <Link to="/register" className="font-medium text-olive-deep underline-offset-4 hover:underline">
              Regístrate
            </Link>
          </>
        }
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <AuthField
            id="email"
            label="Correo"
            type="email"
            placeholder="tu@correo.com"
            icon={<Mail className="h-4 w-4" />}
            value={form.email}
            autoComplete="email"
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <AuthField
            id="password"
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            icon={<Lock className="h-4 w-4" />}
            value={form.password}
            autoComplete="current-password"
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />

          <div className="flex justify-end">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">¿Olvidaste tu contraseña?</a>
          </div>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>
      </AuthCard>
    </main>
  );
}
