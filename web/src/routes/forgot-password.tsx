import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError("Escribe tu correo.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "No se pudo enviar el correo.");
      }

      setInfo(
        typeof data?.message === "string"
          ? data.message
          : "Si ese correo tiene una cuenta, te enviamos un enlace. Revisa tu bandeja (y spam).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8">
        <Link to="/">
          <Logo size="md" />
        </Link>
      </div>

      <AuthCard
        title="Recuperar contraseña"
        subtitle="Te enviaremos un enlace a tu correo"
        footer={
          <>
            ¿La recordaste?{" "}
            <Link to="/login" className="font-medium text-olive-deep underline-offset-4 hover:underline">
              Inicia sesión
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
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {info ? <p className="text-sm text-olive-deep">{info}</p> : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>
      </AuthCard>
    </main>
  );
}
