import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

type CalendarApiResponse = {
  message?: string;
  year?: number;
  month?: number;
  days?: Array<{
    day: number;
    count: number;
  }>;
};

function monthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthMeta(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startsOn = (firstDay.getDay() + 6) % 7;

  return { year, month, daysInMonth, startsOn };
}

function CalendarPage() {
  const navigate = useNavigate();
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayEntryCounts, setDayEntryCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { year, month, daysInMonth, startsOn } = useMemo(() => monthMeta(viewMonth), [viewMonth]);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => index + 1),
    [daysInMonth],
  );

  const leadingEmptyDays = useMemo(
    () => Array.from({ length: startsOn }, (_, index) => `empty-${index}`),
    [startsOn],
  );

  useEffect(() => {
    let active = true;

    const loadCalendar = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/diary/calendar?year=${year}&month=${month}`);
        const data = (await response.json().catch(() => ({}))) as CalendarApiResponse;

        if (!response.ok) {
          if (!active) {
            return;
          }

          setErrorMessage(data.message ?? "No se pudo cargar el calendario.");
          setDayEntryCounts({});
          return;
        }

        const nextCounts: Record<number, number> = {};
        for (const item of data.days ?? []) {
          if (Number.isInteger(item.day) && item.day >= 1 && item.day <= daysInMonth && item.count > 0) {
            nextCounts[item.day] = item.count;
          }
        }

        if (active) {
          setDayEntryCounts(nextCounts);
        }
      } catch {
        if (active) {
          setErrorMessage("No se pudo cargar el calendario.");
          setDayEntryCounts({});
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadCalendar();

    return () => {
      active = false;
    };
  }, [year, month, daysInMonth]);

  const goPrevMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const goToDayEntries = async (day: number) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    await navigate({ to: "/diary", search: { date } });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Calendario" subtitle="Tus días escritos en un vistazo" />

      <div className="paper-card rounded-3xl p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrevMonth}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-2xl">{monthLabel(viewMonth)}</h2>
          <button
            type="button"
            onClick={goNextMonth}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {weekdays.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

        <div className="grid grid-cols-7 gap-2" aria-busy={loading}>
          {leadingEmptyDays.map((cellId) => (
            <div key={cellId} className="aspect-square" aria-hidden="true" />
          ))}

          {days.map((d, i) => {
            const count = dayEntryCounts[d] ?? 0;
            const has = count > 0;
            const isToday = isCurrentMonth && d === today.getDate();
            return (
              <motion.button
                key={d}
                type="button"
                onClick={() => {
                  if (has) {
                    void goToDayEntries(d);
                  }
                }}
                disabled={!has}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.01 }}
                className={`relative aspect-square rounded-xl text-sm transition-all ${
                  isToday
                    ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--olive)]"
                    : has
                      ? "bg-accent/60 text-accent-foreground hover:bg-accent"
                      : "bg-cream/40 text-muted-foreground"
                }`}
                aria-label={
                  has
                    ? `Ver entradas del ${d}. ${count} ${count === 1 ? "entrada" : "entradas"}.`
                    : `Día ${d} sin entradas`
                }
              >
                {d}
                {has && (
                  <span
                    className={`absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none ${
                      isToday ? "bg-primary-foreground/20 text-primary-foreground" : "bg-olive-deep text-cream"
                    }`}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                )}
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
