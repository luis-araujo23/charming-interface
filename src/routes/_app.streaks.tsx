import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_app/streaks")({
  component: StreaksPage,
});

const week = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const written = [true, true, true, false, true, true, false];

function StreaksPage() {
  const count = written.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tu racha" subtitle="Constancia que se siente" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="paper-card relative mb-8 overflow-hidden rounded-3xl p-8 text-center md:p-12"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-mint/20 to-transparent" />
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-olive to-olive-deep shadow-[var(--shadow-glow)]"
          >
            <Flame className="h-12 w-12 text-cream" />
          </motion.div>
          <p className="mt-6 font-display text-6xl text-foreground">{count}/7</p>
          <p className="mt-2 text-sm text-muted-foreground">días escritos esta semana</p>
        </div>
      </motion.div>

      <div className="paper-card rounded-3xl p-6">
        <h3 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Semana actual
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {week.map((day, i) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {day}
              </span>
              <div
                className={`flex h-12 w-full items-center justify-center rounded-xl text-sm ${
                  written[i] ? "bg-primary text-primary-foreground" : "bg-cream/60 text-muted-foreground"
                }`}
              >
                {written[i] && <Check className="h-4 w-4" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
