import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { mockMemories } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/memories")({
  component: MemoriesPage,
});

function MemoriesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Recuerdos" subtitle="Lo que escribiste un día como hoy" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="paper-card relative mb-8 overflow-hidden rounded-3xl p-8 md:p-10"
      >
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-mint/30 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/60 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground">
            <Sparkles className="h-3 w-3" /> Recuerdo de hoy
          </div>
          <p className="font-hand text-2xl text-olive-deep">hace un año</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">{mockMemories[0].title}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {mockMemories[0].excerpt}
          </p>
        </div>
      </motion.div>

      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Otros recuerdos
      </h3>
      <div className="space-y-3">
        {mockMemories.slice(1).map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="paper-card flex gap-5 rounded-2xl p-5"
          >
            <div className="font-display text-3xl text-olive">{m.year}</div>
            <div>
              <h4 className="font-medium">{m.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{m.excerpt}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
