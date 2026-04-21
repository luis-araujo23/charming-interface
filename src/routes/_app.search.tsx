import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import { mockEntries } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/search")({
  component: SearchPage,
});

function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Buscar" subtitle="Encuentra una palabra, una emoción, un día" />

      <div className="relative mb-8">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Escribe una palabra clave…"
          className="h-14 rounded-2xl border-border bg-cream/60 pl-12 text-base shadow-[var(--shadow-paper)]"
        />
      </div>

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Resultados sugeridos
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {mockEntries.slice(0, 4).map((e, i) => (
          <DiaryEntryCard key={e.id} entry={e} index={i} />
        ))}
      </div>
    </div>
  );
}
