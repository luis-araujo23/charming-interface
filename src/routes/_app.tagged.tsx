import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { mockTagged } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/tagged")({
  component: TaggedPage,
});

function TaggedPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notas etiquetadas"
        subtitle="Páginas donde tus amigos te incluyeron"
      />

      <div className="space-y-4">
        {mockTagged.map((t, i) => (
          <motion.article
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="paper-card rounded-2xl p-6"
          >
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3 w-3" /> Etiquetado por <span className="text-olive-deep">{t.author}</span>
              <span className="ml-auto">{t.date}</span>
            </div>
            <h3 className="font-display text-2xl">{t.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.excerpt}</p>
            <button className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-olive-deep hover:underline">
              <MessageCircle className="h-3.5 w-3.5" /> Dejar un mensaje
            </button>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
