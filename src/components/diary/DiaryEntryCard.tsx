import { motion } from "framer-motion";
import { Music, Image as ImageIcon, Tag } from "lucide-react";

export interface DiaryEntryPreview {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  song?: { title: string; artist: string; url?: string };
  photoCount?: number;
  photoUrls?: string[];
  tagCount?: number;
  taggedUsers?: string[];
  taggedComments?: Array<{
    id: number;
    entryTagId: number;
    authorId: number;
    authorUsername: string;
    taggedUserUsername: string;
    message: string;
    createdAt: string;
  }>;
}

export function DiaryEntryCard({ entry, index = 0 }: { entry: DiaryEntryPreview; index?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className="paper-card group cursor-pointer rounded-2xl p-6 transition-shadow hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <time>{entry.date}</time>
        <span className="font-hand text-base normal-case tracking-normal text-olive">página</span>
      </div>
      <h3 className="font-display text-xl text-foreground transition-colors group-hover:text-olive-deep">
        {entry.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{entry.excerpt}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {entry.song && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
            <Music className="h-3 w-3" /> {entry.song.title}
          </span>
        )}
        {entry.photoCount ? (
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3" /> {entry.photoCount}
          </span>
        ) : null}
        {entry.tagCount ? (
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> {entry.tagCount}
          </span>
        ) : null}
      </div>
    </motion.article>
  );
}
