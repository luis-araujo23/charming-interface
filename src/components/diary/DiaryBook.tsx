import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Music, Image as ImageIcon, Tag } from "lucide-react";
import type { DiaryEntryPreview } from "@/components/diary/DiaryEntryCard";

interface DiaryBookProps {
  entries: DiaryEntryPreview[];
}

/**
 * Renders the diary entries as an open book with two facing pages.
 * Left page = entry list (table of contents). Right page = selected entry.
 */
export function DiaryBook({ entries }: DiaryBookProps) {
  const [activeId, setActiveId] = useState(entries[0]?.id ?? null);
  const active = entries.find((e) => e.id === activeId) ?? entries[0];

  const activeIndex = entries.findIndex((e) => e.id === active?.id);
  const goPrev = () => activeIndex > 0 && setActiveId(entries[activeIndex - 1].id);
  const goNext = () =>
    activeIndex < entries.length - 1 && setActiveId(entries[activeIndex + 1].id);

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Book shell */}
      <div className="relative">
        {/* Drop shadow under the book */}
        <div
          aria-hidden
          className="absolute inset-x-8 -bottom-6 h-10 rounded-[50%] bg-olive-deep/30 blur-2xl"
        />

        <div className="relative grid grid-cols-1 overflow-hidden rounded-[28px] border border-olive/20 bg-cream shadow-[var(--shadow-elevated)] md:grid-cols-2">
          {/* Spine / binding (desktop only) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 z-10 hidden w-8 -translate-x-1/2 md:block"
            style={{
              background:
                "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--olive-deep) 18%, transparent) 35%, color-mix(in oklab, var(--olive-deep) 28%, transparent) 50%, color-mix(in oklab, var(--olive-deep) 18%, transparent) 65%, transparent 100%)",
            }}
          />

          {/* LEFT PAGE - index */}
          <section className="paper-texture relative min-h-[640px] p-8 md:p-12">
            {/* page edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-olive-deep/10 to-transparent md:block"
            />

            <header className="mb-6 border-b border-olive/20 pb-4">
              <p className="font-hand text-2xl text-olive-deep">Índice</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Tus entradas
              </p>
            </header>

            <ul className="space-y-1">
              {entries.map((entry, i) => {
                const isActive = entry.id === active?.id;
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => setActiveId(entry.id)}
                      className={`group flex w-full items-baseline gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                        isActive
                          ? "bg-accent/40"
                          : "hover:bg-accent/20"
                      }`}
                    >
                      <span
                        className={`font-display text-sm tabular-nums ${
                          isActive ? "text-olive-deep" : "text-muted-foreground"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`flex-1 truncate font-display text-base ${
                          isActive ? "text-foreground" : "text-foreground/80"
                        }`}
                      >
                        {entry.title}
                      </span>
                      <span
                        aria-hidden
                        className="hidden flex-1 translate-y-[-4px] border-b border-dotted border-olive/30 sm:block"
                      />
                      <span className="font-hand text-base text-olive">{entry.date}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* page number */}
            <div className="absolute bottom-6 left-0 right-0 text-center font-hand text-sm text-muted-foreground">
              — i —
            </div>
          </section>

          {/* RIGHT PAGE - active entry */}
          <section className="paper-texture relative min-h-[640px] p-8 md:p-12">
            {/* page edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-6 bg-gradient-to-r from-olive-deep/10 to-transparent md:block"
            />

            <AnimatePresence mode="wait">
              {active && (
                <motion.article
                  key={active.id}
                  initial={{ opacity: 0, rotateY: -8, x: 12 }}
                  animate={{ opacity: 1, rotateY: 0, x: 0 }}
                  exit={{ opacity: 0, rotateY: 8, x: -12 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  style={{ transformOrigin: "left center" }}
                  className="flex h-full flex-col"
                >
                  <header className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <time>{active.date}</time>
                    <span className="font-hand text-base normal-case tracking-normal text-olive">
                      querido diario,
                    </span>
                  </header>

                  <h2 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                    {active.title}
                  </h2>

                  <div className="mt-5 flex-1 space-y-4 font-display text-[15px] leading-[1.9] text-foreground/85">
                    <p className="first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:font-medium first-letter:leading-none first-letter:text-olive-deep">
                      {active.excerpt}
                    </p>
                    <p className="text-muted-foreground">
                      Hay días que se quedan grabados sin que uno los planee. Hoy fue uno de esos.
                      Las cosas pequeñas, las que nadie ve, también merecen una página.
                    </p>
                  </div>

                  {/* footer chips */}
                  <footer className="mt-6 flex flex-wrap items-center gap-3 border-t border-olive/20 pt-4 text-xs text-muted-foreground">
                    {active.song && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
                        <Music className="h-3 w-3" />
                        {active.song.title} · {active.song.artist}
                      </span>
                    )}
                    {active.photoCount ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ImageIcon className="h-3 w-3" /> {active.photoCount} fotos
                      </span>
                    ) : null}
                    {active.tagCount ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Tag className="h-3 w-3" /> {active.tagCount} etiquetados
                      </span>
                    ) : null}
                  </footer>
                </motion.article>
              )}
            </AnimatePresence>

            {/* page number */}
            <div className="absolute bottom-6 left-0 right-0 text-center font-hand text-sm text-muted-foreground">
              — {activeIndex + 1} —
            </div>
          </section>
        </div>
      </div>

      {/* Page turn controls */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          onClick={goPrev}
          disabled={activeIndex <= 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-cream text-muted-foreground shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-hand text-base text-muted-foreground">
          página {activeIndex + 1} de {entries.length}
        </span>
        <button
          onClick={goNext}
          disabled={activeIndex >= entries.length - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-cream text-muted-foreground shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
