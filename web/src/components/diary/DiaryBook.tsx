import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, MessageCircle, Music, Image as ImageIcon, Tag, X } from "lucide-react";
import type { DiaryEntryPreview } from "@/components/diary/DiaryEntryCard";

interface DiaryBookProps {
  entries: DiaryEntryPreview[];
  initialActiveId?: string;
  onRememberSelection?: (payload: {
    entryId: string;
    entryTitle: string;
    selectedText: string;
  }) => Promise<void> | void;
  rememberSaving?: boolean;
}

const MAX_CHARS_PER_PAGE = 780;
const ENTRIES_PER_INDEX_PAGE = 9;

function paginateExcerpt(text: string, maxCharsPerPage = MAX_CHARS_PER_PAGE) {
  const normalized = text.trim();

  if (!normalized) {
    return [""];
  }

  const words = normalized.split(/\s+/);
  const pages: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxCharsPerPage) {
      current = candidate;
      continue;
    }

    if (current) {
      pages.push(current);
      current = word;
      continue;
    }

    pages.push(word.slice(0, maxCharsPerPage));
    current = word.slice(maxCharsPerPage);
  }

  if (current) {
    pages.push(current);
  }

  return pages.length > 0 ? pages : [normalized];
}

/**
 * Renders the diary entries as an open book with two facing pages.
 * Left page = entry list (table of contents). Right page = selected entry.
 */
export function DiaryBook({ entries, initialActiveId, onRememberSelection, rememberSaving = false }: DiaryBookProps) {
  const [activeId, setActiveId] = useState(entries[0]?.id ?? null);
  const [indexPage, setIndexPage] = useState(0);
  const [indexPageDirection, setIndexPageDirection] = useState<1 | -1>(1);
  const [entryPage, setEntryPage] = useState(0);
  const [entryPageDirection, setEntryPageDirection] = useState<1 | -1>(1);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const selectableTextRef = useRef<HTMLDivElement | null>(null);
  const active = entries.find((e) => e.id === activeId) ?? entries[0];
  const activePhotoUrls = active?.photoUrls ?? [];
  const currentLightboxPhoto =
    lightboxIndex !== null && activePhotoUrls[lightboxIndex] ? activePhotoUrls[lightboxIndex] : null;

  const hasEntryMetaPanels = Boolean(
    (active?.taggedUsers && active.taggedUsers.length > 0)
      || (active?.taggedComments && active.taggedComments.length > 0),
  );
  const excerptPages = useMemo(() => paginateExcerpt(active?.excerpt ?? "", MAX_CHARS_PER_PAGE), [active?.excerpt]);
  const contentPageCount = excerptPages.length;
  const totalEntryPages = contentPageCount + (hasEntryMetaPanels ? 1 : 0);
  const isMetaOnlyPage = hasEntryMetaPanels && entryPage === totalEntryPages - 1;
  const currentExcerptPage = excerptPages[entryPage] ?? excerptPages[0] ?? "";

  useEffect(() => {
    setEntryPage(0);
    setEntryPageDirection(1);
    setLightboxIndex(null);
    setSelectedText("");
  }, [active?.id]);

  useEffect(() => {
    if (!initialActiveId) {
      return;
    }

    const existsInList = entries.some((entry) => entry.id === initialActiveId);
    if (existsInList) {
      setActiveId(initialActiveId);
    }
  }, [entries, initialActiveId]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => {
          if (current === null || current <= 0) {
            return current;
          }

          return current - 1;
        });
      }

      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => {
          if (current === null || current >= activePhotoUrls.length - 1) {
            return current;
          }

          return current + 1;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, activePhotoUrls.length]);

  useEffect(() => {
    const updateSelection = () => {
      const container = selectableTextRef.current;
      const selection = window.getSelection();

      if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectedText("");
        return;
      }

      const range = selection.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;

      if (!container.contains(commonAncestor)) {
        setSelectedText("");
        return;
      }

      setSelectedText(selection.toString().trim().slice(0, 2000));
    };

    document.addEventListener("selectionchange", updateSelection);
    return () => document.removeEventListener("selectionchange", updateSelection);
  }, []);

  const activeIndex = entries.findIndex((e) => e.id === active?.id);
  const totalIndexPages = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_INDEX_PAGE));
  const indexStart = indexPage * ENTRIES_PER_INDEX_PAGE;
  const indexEntries = entries.slice(indexStart, indexStart + ENTRIES_PER_INDEX_PAGE);

  useEffect(() => {
    const maxPage = Math.max(0, totalIndexPages - 1);
    if (indexPage > maxPage) {
      setIndexPage(maxPage);
    }
  }, [indexPage, totalIndexPages]);

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }

    const activePage = Math.floor(activeIndex / ENTRIES_PER_INDEX_PAGE);
    setIndexPage((currentPage) => {
      if (activePage === currentPage) {
        return currentPage;
      }

      setIndexPageDirection(activePage > currentPage ? 1 : -1);
      return activePage;
    });
  }, [activeIndex]);

  const goPrev = () => activeIndex > 0 && setActiveId(entries[activeIndex - 1].id);
  const goNext = () =>
    activeIndex < entries.length - 1 && setActiveId(entries[activeIndex + 1].id);

  const goPrevIndexPage = () => {
    if (indexPage <= 0) {
      return;
    }

    setIndexPageDirection(-1);
    setIndexPage((current) => current - 1);
  };

  const goNextIndexPage = () => {
    if (indexPage >= totalIndexPages - 1) {
      return;
    }

    setIndexPageDirection(1);
    setIndexPage((current) => current + 1);
  };

  const goPrevEntryPage = () => {
    if (entryPage <= 0) {
      return;
    }

    setEntryPageDirection(-1);
    setEntryPage((current) => current - 1);
  };

  const goNextEntryPage = () => {
    if (entryPage >= totalEntryPages - 1) {
      return;
    }

    setEntryPageDirection(1);
    setEntryPage((current) => current + 1);
  };

  const handleRememberSelectionClick = async () => {
    const cleanSelection = selectedText.trim();
    if (!cleanSelection || !active || !onRememberSelection) {
      return;
    }

    await onRememberSelection({
      entryId: active.id,
      entryTitle: active.title,
      selectedText: cleanSelection,
    });

    window.getSelection()?.removeAllRanges();
    setSelectedText("");
  };

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
          <section className="paper-texture relative h-[640px] overflow-hidden p-8 md:p-12">
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

            <div className="overflow-hidden pb-16">
              <AnimatePresence mode="wait" initial={false}>
                <motion.ul
                  key={`index-page-${indexPage}`}
                  initial={{ opacity: 0, x: indexPageDirection > 0 ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: indexPageDirection > 0 ? -20 : 20 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="space-y-1"
                >
                  {indexEntries.map((entry, i) => {
                    const isActive = entry.id === active?.id;
                    const visibleIndex = indexStart + i + 1;

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
                            {String(visibleIndex).padStart(2, "0")}
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
                </motion.ul>
              </AnimatePresence>
            </div>

            {totalIndexPages > 1 ? (
              <div className="absolute bottom-6 right-8 z-20 flex items-center justify-end gap-2 text-xs text-muted-foreground md:right-12">
                <button
                  onClick={goPrevIndexPage}
                  disabled={indexPage <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-cream shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
                  aria-label="Página anterior del índice"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-hand text-sm">
                  hoja {indexPage + 1} de {totalIndexPages}
                </span>
                <button
                  onClick={goNextIndexPage}
                  disabled={indexPage >= totalIndexPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-cream shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
                  aria-label="Página siguiente del índice"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            {/* page number */}
            <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center font-hand text-sm text-muted-foreground">
              — i —
            </div>
          </section>

          {/* RIGHT PAGE - active entry */}
          <section className="paper-texture relative h-[640px] overflow-hidden p-8 md:p-12">
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
                  className={`flex h-full flex-col ${isMetaOnlyPage ? "pb-20" : ""}`}
                >
                  <header className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <time>{active.date}</time>
                    <span className="font-hand text-base normal-case tracking-normal text-olive">
                      Querida Kitty
                    </span>
                  </header>

                  <h2 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                    {active.title}
                  </h2>

                  {!isMetaOnlyPage ? (
                    <div
                      ref={selectableTextRef}
                      className="mt-5 flex-1 overflow-hidden font-display text-[15px] leading-[1.9] text-foreground/85"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={`${active.id}-page-${entryPage}`}
                          initial={{ opacity: 0, x: entryPageDirection > 0 ? 26 : -26 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: entryPageDirection > 0 ? -26 : 26 }}
                          transition={{ duration: 0.26, ease: "easeOut" }}
                          className="first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-5xl first-letter:font-medium first-letter:leading-none first-letter:text-olive-deep"
                        >
                          {currentExcerptPage}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="mt-5 flex-1" />
                  )}

                  {!isMetaOnlyPage && active.photoUrls && active.photoUrls.length > 0 ? (
                    <div className="photo-strip-scroll mt-3 overflow-x-auto pb-1">
                      <div className="flex min-w-max items-center gap-2">
                        {active.photoUrls.map((photoUrl, photoIndex) => (
                          <button
                            type="button"
                            key={`${active.id}-photo-${photoIndex}`}
                            onClick={() => setLightboxIndex(photoIndex)}
                            className="group relative h-16 w-16 overflow-hidden rounded-md border border-olive/20 bg-secondary/30"
                            aria-label={`Abrir foto ${photoIndex + 1}`}
                          >
                            <img
                              src={photoUrl}
                              alt={`Foto ${photoIndex + 1} de la entrada ${active.title}`}
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* footer chips */}
                  {selectedText && !isMetaOnlyPage && onRememberSelection ? (
                    <div className="mt-3 rounded-lg border border-olive/20 bg-accent/20 p-2.5">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        Texto seleccionado
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground/85">{selectedText}</p>
                      <button
                        type="button"
                        onClick={() => void handleRememberSelectionClick()}
                        disabled={rememberSaving}
                        className="mt-2 rounded-full border border-olive/25 bg-cream px-3 py-1 text-xs text-olive-deep transition hover:bg-accent/30 disabled:opacity-50"
                      >
                        {rememberSaving ? "Guardando..." : "Guardar en recuerdos"}
                      </button>
                    </div>
                  ) : null}

                  <footer className={`mt-6 flex flex-wrap items-center gap-3 border-t border-olive/20 pt-4 text-xs text-muted-foreground ${isMetaOnlyPage ? "opacity-60" : ""}`}>
                    {active.song && (
                      active.song.url ? (
                        <a
                          href={active.song.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 underline-offset-2 transition hover:underline"
                        >
                          <Music className="h-3 w-3" />
                          {active.song.title} · {active.song.artist}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
                          <Music className="h-3 w-3" />
                          {active.song.title} · {active.song.artist}
                        </span>
                      )
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

                  <AnimatePresence initial={false} mode="wait">
                    {isMetaOnlyPage ? (
                      <motion.div
                        key={`${active.id}-meta-page`}
                        initial={{ opacity: 0, y: 14, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.99 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                        className="mt-3 space-y-3"
                      >
                        {active.taggedUsers && active.taggedUsers.length > 0 ? (
                          <div className="rounded-lg border border-olive/10 bg-secondary/15 p-2.5">
                            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Usuarios etiquetados
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {active.taggedUsers.map((username) => (
                                <span
                                  key={`${active.id}-tagged-${username}`}
                                  className="inline-flex items-center rounded-full bg-cream px-2.5 py-0.5 text-[11px] text-olive-deep shadow-[var(--shadow-paper)]"
                                >
                                  @{username}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {active.taggedComments && active.taggedComments.length > 0 ? (
                          <div className="rounded-lg border border-olive/10 bg-secondary/15 p-2.5">
                            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              <MessageCircle className="h-3.5 w-3.5" /> Comentarios de etiquetados
                            </div>
                            <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                              {active.taggedComments.map((comment) => (
                                <div key={`${active.id}-comment-${comment.id}`} className="rounded-md bg-cream p-2.5 shadow-[var(--shadow-paper)]">
                                  <p className="text-[11px] font-medium text-olive-deep">
                                    @{comment.authorUsername} escribio sobre la etiqueta de @{comment.taggedUserUsername}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
                                    {comment.message}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              )}
            </AnimatePresence>

            {active && totalEntryPages > 1 ? (
              <div className="absolute bottom-6 right-8 z-20 flex items-center justify-end gap-2 text-xs text-muted-foreground md:right-12">
                <button
                  onClick={goPrevEntryPage}
                  disabled={entryPage <= 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-cream shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
                  aria-label="Página anterior de la entrada"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-hand text-sm">
                  hoja {entryPage + 1} de {totalEntryPages}
                </span>
                <button
                  onClick={goNextEntryPage}
                  disabled={entryPage >= totalEntryPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-cream shadow-[var(--shadow-paper)] transition hover:text-foreground disabled:opacity-40"
                  aria-label="Página siguiente de la entrada"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            {/* page number */}
            <div className="pointer-events-none absolute bottom-6 left-0 right-0 text-center font-hand text-sm text-muted-foreground">
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

      <AnimatePresence>
        {currentLightboxPhoto ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
            onClick={() => setLightboxIndex(null)}
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="relative w-full max-w-5xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="absolute -top-12 right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/35"
                aria-label="Cerrar imagen"
              >
                <X className="h-4 w-4" />
              </button>

              <img
                src={currentLightboxPhoto}
                alt={`Imagen ${lightboxIndex !== null ? lightboxIndex + 1 : 1} de la entrada ${active?.title ?? ""}`}
                className="max-h-[82vh] w-full rounded-xl object-contain shadow-2xl"
              />

              {lightboxIndex !== null && activePhotoUrls.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((current) => {
                        if (current === null || current <= 0) {
                          return current;
                        }

                        return current - 1;
                      })
                    }
                    disabled={lightboxIndex <= 0}
                    className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((current) => {
                        if (current === null || current >= activePhotoUrls.length - 1) {
                          return current;
                        }

                        return current + 1;
                      })
                    }
                    disabled={lightboxIndex >= activePhotoUrls.length - 1}
                    className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/35 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Foto siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
