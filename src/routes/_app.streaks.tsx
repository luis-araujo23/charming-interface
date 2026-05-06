import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Flame, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_app/streaks")({
  component: StreaksPage,
});

const week = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type StreakApiResponse = {
  message?: string;
  daysWritten?: number;
  completed?: boolean;
  totalCompletedWeeks?: number;
  completedWeeksHistory?: Array<{
    weekStartDate: string;
    weekEndDate: string;
    daysWritten: number;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  days?: Array<{
    label: string;
    date: string;
    written: boolean;
  }>;
};

function formatWeekDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function StreaksPage() {
  const [days, setDays] = useState(
    week.map((label) => ({ label, written: false })),
  );
  const [daysWritten, setDaysWritten] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [totalCompletedWeeks, setTotalCompletedWeeks] = useState(0);
  const [completedWeeksHistory, setCompletedWeeksHistory] = useState<
    NonNullable<StreakApiResponse["completedWeeksHistory"]>
  >([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadStreak = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/streaks");
        const data = (await response.json().catch(() => ({}))) as StreakApiResponse;

        if (!response.ok) {
          if (active) {
            setErrorMessage(data.message ?? "No se pudo cargar tu racha semanal.");
          }
          return;
        }

        if (!active) {
          return;
        }

        const incomingDays = data.days ?? [];
        const normalizedDays = week.map((defaultLabel, index) => {
          const day = incomingDays[index];
          return {
            label: day?.label ?? defaultLabel,
            written: Boolean(day?.written),
          };
        });

        const resolvedDaysWritten =
          typeof data.daysWritten === "number"
            ? data.daysWritten
            : normalizedDays.filter((day) => day.written).length;

        setDays(normalizedDays);
        setDaysWritten(resolvedDaysWritten);
        setCompleted(Boolean(data.completed) || resolvedDaysWritten >= 7);
        setTotalCompletedWeeks(typeof data.totalCompletedWeeks === "number" ? data.totalCompletedWeeks : 0);
        setCompletedWeeksHistory(data.completedWeeksHistory ?? []);
      } catch {
        if (active) {
          setErrorMessage("No se pudo cargar tu racha semanal.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const onWindowFocus = () => {
      void loadStreak();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadStreak();
      }
    };

    void loadStreak();
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const countLabel = useMemo(() => `${daysWritten}/7`, [daysWritten]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tu racha" subtitle="Constancia que se siente" />

      {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

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
          <p className="mt-6 font-display text-6xl text-foreground">{countLabel}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {loading ? "cargando racha..." : completed ? "semana completada" : "días escritos esta semana"}
          </p>
        </div>
      </motion.div>

      <div className="paper-card rounded-3xl p-6">
        <h3 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Semana actual
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => (
            <motion.div
              key={day.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {day.label}
              </span>
              <div
                className={`flex h-12 w-full items-center justify-center rounded-xl text-sm ${
                  day.written ? "bg-primary text-primary-foreground" : "bg-cream/60 text-muted-foreground"
                }`}
              >
                {day.written && <Check className="h-4 w-4" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="paper-card rounded-3xl p-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rachas completas
          </h3>
          <p className="mt-4 font-display text-5xl text-foreground">{totalCompletedWeeks}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalCompletedWeeks === 1
              ? "semana perfecta acumulada"
              : "semanas perfectas acumuladas"}
          </p>
        </div>

        <div className="paper-card rounded-3xl p-6">
          <h3 className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Historial de rachas
          </h3>

          {completedWeeksHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no has completado una semana perfecta.
            </p>
          ) : (
            <div className="space-y-3">
              {completedWeeksHistory.map((item) => (
                <div
                  key={item.weekStartDate}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-cream/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {formatWeekDate(item.weekStartDate)} - {formatWeekDate(item.weekEndDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.daysWritten}/7 dias escritos
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Completa
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
