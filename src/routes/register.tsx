import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthField } from "@/components/auth/AuthField";
import { User, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8">
        <Link to="/"><Logo size="md" /></Link>
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
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <AuthField id="username" label="Usuario" placeholder="tunombre" icon={<User className="h-4 w-4" />} />
          <AuthField id="email" label="Correo" type="email" placeholder="tu@correo.com" icon={<Mail className="h-4 w-4" />} />
          <AuthField id="password" label="Contraseña" type="password" placeholder="mínimo 8 caracteres" icon={<Lock className="h-4 w-4" />} />

          <Button asChild type="submit" className="h-11 w-full rounded-xl bg-primary text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)]">
            <Link to="/diary">Crear cuenta</Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Al registrarte aceptas nuestros términos y política de privacidad.
          </p>
        </form>
      </AuthCard>
    </main>
  );
}
