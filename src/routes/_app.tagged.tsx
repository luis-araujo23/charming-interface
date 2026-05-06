import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { markTaggedNotesAsSeen } from "@/lib/tagged-notifications";

export const Route = createFileRoute("/_app/tagged")({
  component: TaggedPage,
});

type TaggedComment = {
  id: number;
  entryTagId: number;
  authorId: number;
  authorUsername: string;
  message: string;
  createdAt: string;
};

type TaggedNote = {
  entryTagId: number;
  entryId: number;
  title: string | null;
  content: string;
  entryDate: string;
  taggedByUsername: string;
  taggedAt: string;
  comments: TaggedComment[];
};

type TaggedApiResponse = {
  message?: string;
  notes?: TaggedNote[];
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

function TaggedPage() {
  const [notes, setNotes] = useState<TaggedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [submittingEntryTagId, setSubmittingEntryTagId] = useState<number | null>(null);

  const noteCount = useMemo(() => notes.length, [notes]);

  const loadTaggedNotes = async () => {
    setErrorMessage(null);

    try {
      const response = await fetch("/api/tagged");
      const data = (await response.json().catch(() => ({}))) as TaggedApiResponse;

      if (!response.ok) {
        setErrorMessage(data.message ?? "No se pudieron cargar tus notas etiquetadas.");
        return;
      }

      const nextNotes = data.notes ?? [];
      setNotes(nextNotes);
      markTaggedNotesAsSeen(nextNotes.map((note) => note.entryTagId));
      window.dispatchEvent(new Event("tagged:changed"));
    } catch {
      setErrorMessage("No se pudieron cargar tus notas etiquetadas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaggedNotes();
  }, []);

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>, entryTagId: number) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const message = (commentDrafts[entryTagId] ?? "").trim();

    if (!message) {
      setErrorMessage("Escribe un comentario antes de enviarlo.");
      return;
    }

    setSubmittingEntryTagId(entryTagId);

    try {
      const response = await fetch("/api/tagged/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entryTagId, message }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(data.message ?? "No se pudo enviar el comentario.");
        return;
      }

      setCommentDrafts((prev) => ({ ...prev, [entryTagId]: "" }));
      setSuccessMessage(data.message ?? "Comentario enviado.");
      await loadTaggedNotes();
    } catch {
      setErrorMessage("No se pudo enviar el comentario.");
    } finally {
      setSubmittingEntryTagId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notas etiquetadas"
        subtitle={noteCount > 0 ? `Tienes ${noteCount} nota(s) donde te etiquetaron` : "Páginas donde tus amigos te incluyeron"}
      />

      {errorMessage ? <p className="mb-4 text-sm text-red-500">{errorMessage}</p> : null}
      {successMessage ? <p className="mb-4 text-sm text-green-600">{successMessage}</p> : null}
      {!loading && notes.length === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-cream/40 p-4 text-sm text-muted-foreground">
          Aún no tienes notas etiquetadas.
        </p>
      ) : null}

      <div className="space-y-4">
        {notes.map((note, i) => (
          <motion.article
            key={note.entryTagId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="paper-card rounded-2xl p-6"
          >
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Tag className="h-3 w-3" /> Etiquetado por <span className="text-olive-deep">@{note.taggedByUsername}</span>
              <span className="ml-auto">{formatDate(note.entryDate)}</span>
            </div>
            <h3 className="font-display text-2xl">{note.title?.trim() || "Entrada sin título"}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{note.content}</p>

            <div className="mt-5 space-y-3 rounded-xl border border-border/60 bg-cream/40 p-4">
              <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> Comentarios
              </div>

              {note.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay comentarios en esta etiqueta.</p>
              ) : (
                <div className="space-y-2">
                  {note.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-background/70 p-3">
                      <p className="mb-1 text-xs font-medium text-olive-deep">@{comment.authorUsername}</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{comment.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(comment.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}

              <form className="space-y-2" onSubmit={(event) => void handleCommentSubmit(event, note.entryTagId)}>
                <Textarea
                  placeholder="Escribe un comentario para esta nota..."
                  value={commentDrafts[note.entryTagId] ?? ""}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCommentDrafts((prev) => ({
                      ...prev,
                      [note.entryTagId]: nextValue,
                    }));
                  }}
                  maxLength={1200}
                  className="min-h-20"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="rounded-full"
                    disabled={submittingEntryTagId === note.entryTagId}
                  >
                    {submittingEntryTagId === note.entryTagId ? "Enviando..." : "Comentar"}
                  </Button>
                </div>
              </form>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
