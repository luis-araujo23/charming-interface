import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const Route = createFileRoute("/_app/memories")({
  component: MemoriesPage,
});

type MemoryItem = {
  id: number;
  entryId: number;
  entryTitle: string;
  entryDate: string;
  memoryDate: string;
  selectedText: string;
  createdAt: string;
};

type MemoriesApiResponse = {
  message?: string;
  memories?: MemoryItem[];
};

function formatDate(value: string) {
  if (!value) {
    return "Fecha desconocida";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function MemoriesPage() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const featuredMemory = useMemo(() => memories[0] ?? null, [memories]);
  const otherMemories = useMemo(() => memories.slice(1), [memories]);

  useEffect(() => {
    const loadMemories = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/memories");
        const data = (await response.json().catch(() => ({}))) as MemoriesApiResponse;

        if (!response.ok) {
          setErrorMessage(data.message ?? "No se pudieron cargar tus recuerdos.");
          setMemories([]);
          return;
        }

        setMemories(data.memories ?? []);
      } catch {
        setErrorMessage("No se pudieron cargar tus recuerdos.");
        setMemories([]);
      } finally {
        setLoading(false);
      }
    };

    void loadMemories();
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Recuerdos" subtitle="Fragmentos que decidiste guardar" />

      {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

      {!loading && !errorMessage && memories.length === 0 ? (
        <p className="rounded-2xl border border-border bg-cream/60 px-4 py-6 text-sm text-muted-foreground">
          Aún no tienes recuerdos guardados. Ve al diario, selecciona un fragmento y guárdalo en esta sección.
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`memory-skeleton-${index}`}
              className="h-28 animate-pulse rounded-2xl border border-border/70 bg-cream/40"
            />
          ))}
        </div>
      ) : null}

      {!loading && featuredMemory ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          onDoubleClick={() => void navigate({ to: "/diary", search: { entryId: String(featuredMemory.entryId) } })}
          className="paper-card relative mb-8 cursor-pointer overflow-hidden rounded-3xl p-8 md:p-10"
          title="Doble click para abrir la entrada completa"
        >
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-mint/30 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground">
              <Sparkles className="h-3 w-3" /> Recuerdo destacado
            </div>
            <p className="font-hand text-lg text-olive-deep">{formatDate(featuredMemory.entryDate)}</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">{featuredMemory.entryTitle}</h2>
            <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
              {featuredMemory.selectedText}
            </p>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
              Doble click para abrir la entrada completa
            </p>
          </div>
        </motion.div>
      ) : null}

      {!loading && otherMemories.length > 0 ? (
        <>
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Otros recuerdos
          </h3>
          <div className="space-y-3">
            {otherMemories.map((memory, i) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                onDoubleClick={() => void navigate({ to: "/diary", search: { entryId: String(memory.entryId) } })}
                className="paper-card cursor-pointer rounded-2xl p-5"
                title="Doble click para abrir la entrada completa"
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{formatDate(memory.entryDate)}</span>
                  <span>Entrada #{memory.entryId}</span>
                </div>
                <h4 className="font-medium">{memory.entryTitle}</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{memory.selectedText}</p>
              </motion.div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
