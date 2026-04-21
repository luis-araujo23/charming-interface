import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

const daysWithEntries = new Set([2, 5, 8, 9, 14, 15, 17, 18, 20, 21]);
const today = 21;
const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

function CalendarPage() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Calendario" subtitle="Tus días escritos en un vistazo" />

      <div className="paper-card rounded-3xl p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between">
          <button className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-2xl">Abril 2026</h2>
          <button className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {weekdays.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const has = daysWithEntries.has(d);
            const isToday = d === today;
            return (
              <motion.button
                key={d}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.01 }}
                className={`relative aspect-square rounded-xl text-sm transition-all ${
                  isToday
                    ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--olive)]"
                    : has
                      ? "bg-accent/60 text-accent-foreground hover:bg-accent"
                      : "bg-cream/40 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d}
                {has && !isToday && (
                  <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-olive-deep" />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-primary" /> Hoy</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-accent/60" /> Con entrada</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-cream border border-border" /> Sin entrada</span>
        </div>
      </div>
    </div>
  );
}
