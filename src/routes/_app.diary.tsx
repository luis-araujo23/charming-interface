import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiaryBook } from "@/components/diary/DiaryBook";
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

      <DiaryBook entries={mockEntries} />
    </div>
  );
}
