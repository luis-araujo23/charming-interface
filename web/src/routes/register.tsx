import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { User, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [confirmLink, setConfirmLink] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPendingEmail(null);
    setConfirmLink(null);

    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Completa usuario, correo y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.code === "EMAIL_NOT_CONFIRMED" && typeof data?.email === "string") {
          setPendingEmail(data.email);
          if (typeof data?.confirmLink === "string") setConfirmLink(data.confirmLink);
          // Account exists unverified — show verify UI instead of a hard error.
          return;
        }
        throw new Error(data?.message ?? "No se pudo crear la cuenta");
      }

      if (data?.needsEmailConfirmation) {
        setPendingEmail(typeof data.email === "string" ? data.email : form.email.trim().toLowerCase());
        if (typeof data.confirmLink === "string") setConfirmLink(data.confirmLink);
        if (typeof data.message === "string" && data.emailSent === false) {
          setError(data.message);
        }
        return;
      }

      await navigate({ to: "/diary" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
        <div className="mb-8">
          <Link to="/">
            <Logo size="md" />
          </Link>
        </div>

        <AuthCard
          title="Verifica tu correo"
          subtitle="Un paso más para activar tu diario"
          footer={
            <>
              ¿Ya lo confirmaste?{" "}
              <Link to="/login" className="font-medium text-olive-deep underline-offset-4 hover:underline">
                Inicia sesión
              </Link>
            </>
          }
        >
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Cuenta creada para{" "}
              <span className="font-medium text-foreground">{pendingEmail}</span>.
              Gmail a veces no muestra el correo: verifica aquí mismo.
            </p>
            {error ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
            ) : null}
            {confirmLink ? (
              <Button asChild className="h-11 w-full rounded-xl">
                <a href={confirmLink}>Verificar ahora</a>
              </Button>
            ) : (
              <p>
                Ve a Iniciar sesión → «Reenviar correo de verificación» para obtener el enlace.
              </p>
            )}
            <Button asChild variant="outline" className="h-11 w-full rounded-xl">
              <Link to="/login">Ir a iniciar sesión</Link>
            </Button>
          </div>
        </AuthCard>
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
        title="Crea tu diario"
        subtitle="Empieza a escribir tu historia"
        footer={
          <>
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-medium text-olive-deep underline-offset-4 hover:underline">
              Inicia sesión
            </Link>
          </>
        }
      >
        <form className="space-y-5" onSubmit={onSubmit}>
          <AuthField
            id="username"
            label="Usuario"
            placeholder="tunombre"
            icon={<User className="h-4 w-4" />}
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
          />

          <AuthField
            id="email"
            label="Correo"
            type="email"
            placeholder="tu@correo.com"
            icon={<Mail className="h-4 w-4" />}
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />

          <AuthField
            id="password"
            label="Contraseña"
            type="password"
            placeholder="mínimo 8 caracteres"
            icon={<Lock className="h-4 w-4" />}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Te enviaremos un correo para verificar tu cuenta antes de poder entrar.
          </p>
        </form>
      </AuthCard>
    </main>
  );
}
