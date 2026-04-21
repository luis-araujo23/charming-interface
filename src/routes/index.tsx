import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* decorative orbs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-mint/30 blur-3xl"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-10 h-[28rem] w-[28rem] rounded-full bg-olive/20 blur-3xl"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <Logo size="lg" showTagline />

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-12 font-display text-4xl leading-tight text-foreground md:text-6xl"
        >
          Escribe lo que <span className="italic text-olive-deep ink-underline">sientes</span>,
          <br />
          guarda lo que <span className="italic text-olive-deep">vives</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="mt-6 max-w-lg text-base text-muted-foreground md:text-lg"
        >
          Un diario digital íntimo, con fotos, canciones y recuerdos.
          Comparte momentos con quienes importan.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-12 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:justify-center"
        >
          <Button asChild size="lg" className="h-12 rounded-full bg-primary px-8 text-base font-medium shadow-[0_10px_30px_-10px_var(--olive)] hover:opacity-90">
            <Link to="/register">Crear cuenta</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-olive/40 bg-cream/60 px-8 text-base font-medium hover:bg-cream">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span>diario</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>fotos</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>canciones</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>recuerdos</span>
        </motion.div>
      </div>
    </main>
  );
}
