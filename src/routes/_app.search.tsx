import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import type { DiaryEntryPreview } from "@/components/diary/DiaryEntryCard";

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
});

type DiarySearchApiEntry = {
  id: string | number;
  title: string | null;
  content: string;
  entry_date: string;
  song_title: string | null;
  song_artist: string | null;
  song_url: string | null;
  photo_count?: number;
  photo_urls?: string[] | null;
};

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatEntryDate(value: string) {
  if (typeof value !== "string" || !value.trim()) {
    return "Fecha inválida";
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const monthRaw = parts.find((part) => part.type === "month")?.value ?? "";
  const month = monthRaw.replace(".", "");

  if (!day || !month) {
    return value;
  }

  return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

function mapEntry(entry: DiarySearchApiEntry): DiaryEntryPreview {
  const title = entry.title?.trim() || "Entrada sin título";
  const excerpt = entry.content.trim();
  const songTitle = entry.song_title?.trim();
  const songArtist = entry.song_artist?.trim();
  const songUrl = entry.song_url?.trim();
  const photoUrls = (entry.photo_urls ?? []).filter(
    (url): url is string => typeof url === "string" && isHttpUrl(url),
  );

  return {
    id: String(entry.id),
    title,
    excerpt,
    date: formatEntryDate(entry.entry_date),
    photoCount: entry.photo_count && entry.photo_count > 0 ? entry.photo_count : undefined,
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    song:
      songTitle && songArtist
        ? {
            title: songTitle,
            artist: songArtist,
            ...(songUrl ? { url: songUrl } : {}),
          }
        : undefined,
  };
}

function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DiaryEntryPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    let active = true;

    const timeoutId = window.setTimeout(() => {
      const loadResults = async () => {
        setLoading(true);
        setErrorMessage(null);

        try {
          const searchParam = trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : "";
          const response = await fetch(`/api/diary/search${searchParam}`);
          const data = (await response.json().catch(() => ({}))) as {
            message?: string;
            entries?: DiarySearchApiEntry[];
          };

          if (!response.ok) {
            if (!active) {
              return;
            }

            setErrorMessage(data.message ?? "No se pudo realizar la búsqueda.");
            setEntries([]);
            return;
          }

          if (active) {
            setEntries((data.entries ?? []).map(mapEntry));
          }
        } catch {
          if (active) {
            setErrorMessage("No se pudo realizar la búsqueda.");
            setEntries([]);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void loadResults();
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Buscar" subtitle="Encuentra una palabra, una emoción, un día" />

      <div className="relative mb-8">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Escribe una palabra clave…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-14 rounded-2xl border-border bg-cream/60 pl-12 text-base shadow-[var(--shadow-paper)]"
        />
      </div>

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {trimmedQuery ? `Resultados para \"${trimmedQuery}\"` : "Entradas recientes"}
      </h2>

      {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

      {!loading && !errorMessage && entries.length === 0 ? (
        <p className="rounded-2xl border border-border bg-cream/60 px-4 py-6 text-sm text-muted-foreground">
          {trimmedQuery
            ? "No encontramos entradas con esa palabra clave. Prueba con otro término."
            : "Aún no tienes entradas para mostrar."}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`search-skeleton-${i}`}
                className="h-44 animate-pulse rounded-2xl border border-border/70 bg-cream/40"
              />
            ))
          : null}

        {!loading &&
          entries.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => void navigate({ to: "/diary", search: { entryId: e.id } })}
            className="text-left"
            aria-label={`Abrir entrada ${e.title}`}
          >
            <DiaryEntryCard entry={e} index={i} />
          </button>
          ))}
      </div>
    </div>
  );
}
