import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import { mockEntries } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/diary")({
  component: DiaryPage,
});

function DiaryPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tu diario"
        subtitle="Hoy es un buen día para escribir"
        action={
          <Button className="h-10 rounded-full bg-primary px-5 text-sm shadow-[0_8px_24px_-8px_var(--olive)]">
            <Plus className="mr-1.5 h-4 w-4" /> Nueva entrada
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {mockEntries.map((entry, i) => (
          <DiaryEntryCard key={entry.id} entry={entry} index={i} />
        ))}
      </div>
    </div>
  );
}
