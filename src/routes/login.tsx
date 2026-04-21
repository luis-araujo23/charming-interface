import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
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
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <AuthField id="email" label="Correo" type="email" placeholder="tu@correo.com" icon={<Mail className="h-4 w-4" />} />
          <AuthField id="password" label="Contraseña" type="password" placeholder="••••••••" icon={<Lock className="h-4 w-4" />} />

          <div className="flex justify-end">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground">¿Olvidaste tu contraseña?</a>
          </div>

          <Button asChild type="submit" className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]">
            <Link to="/diary">Iniciar sesión</Link>
          </Button>
        </form>
      </AuthCard>
    </main>
  );
}
