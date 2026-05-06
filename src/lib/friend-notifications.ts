const SEEN_REQUESTS_STORAGE_KEY = "friends_seen_incoming_request_ids_v1";

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

export function getSeenIncomingFriendRequestIds() {
  if (typeof window === "undefined") {
    return new Set<number>();
  }

  return parseSeenIds(window.localStorage.getItem(SEEN_REQUESTS_STORAGE_KEY));
}

export function markIncomingFriendRequestsAsSeen(friendshipIds: number[]) {
  if (typeof window === "undefined") {
    return;
  }

  const seenIds = getSeenIncomingFriendRequestIds();
  for (const id of friendshipIds) {
    if (Number.isInteger(id) && id > 0) {
      seenIds.add(id);
    }
  }

  window.localStorage.setItem(SEEN_REQUESTS_STORAGE_KEY, JSON.stringify([...seenIds]));
}