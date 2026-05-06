const SEEN_TAGGED_NOTES_STORAGE_KEY = "tagged_seen_entry_tag_ids_v1";

function parseSeenIds(rawValue: string | null) {
  if (!rawValue) {
    return new Set<number>();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set<number>();
    }

    return new Set(
      parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    );
  } catch {
    return new Set<number>();
  }
}

export function getSeenTaggedNoteIds() {
  if (typeof window === "undefined") {
    return new Set<number>();
  }

  return parseSeenIds(window.localStorage.getItem(SEEN_TAGGED_NOTES_STORAGE_KEY));
}

export function markTaggedNotesAsSeen(entryTagIds: number[]) {
  if (typeof window === "undefined") {
    return;
  }

  const seenIds = getSeenTaggedNoteIds();
  for (const id of entryTagIds) {
    if (Number.isInteger(id) && id > 0) {
      seenIds.add(id);
    }
  }

  window.localStorage.setItem(SEEN_TAGGED_NOTES_STORAGE_KEY, JSON.stringify([...seenIds]));
}
