import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import { UserMinus, X, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { markIncomingFriendRequestsAsSeen } from "@/lib/friend-notifications";

export const Route = createFileRoute("/_app/friends")({
  component: FriendsPage,
});

type PendingRequest = {
  friendshipId: number;
  userId: number;
  username: string;
};

type FriendUser = {
  friendshipId: number;
  userId: number;
  username: string;
};

type UserSuggestion = {
  userId: number;
  username: string;
  email: string | null;
};

type FriendsApiResponse = {
  message?: string;
  pendingRequests?: PendingRequest[];
  outgoingPendingRequests?: PendingRequest[];
  friends?: FriendUser[];
};

function toDisplayName(username: string) {
  return username;
}

function toInitials(username: string) {
  const clean = username.trim();
  if (!clean) {
    return "??";
  }

  const parts = clean.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  return clean.slice(0, 2).toUpperCase();
}

function FriendsPage() {
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [outgoingPendingRequests, setOutgoingPendingRequests] = useState<PendingRequest[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [cancelingRequestId, setCancelingRequestId] = useState<number | null>(null);
  const [deletingFriendshipId, setDeletingFriendshipId] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const loadFriendsData = async () => {
    setListError(null);

    try {
      const response = await fetch("/api/friends");
      const data = (await response.json().catch(() => ({}))) as FriendsApiResponse;

      if (!response.ok) {
        setListError(data.message ?? "No se pudieron cargar tus amigos.");
        return;
      }

      const incomingRequests = data.pendingRequests ?? [];
      setPendingRequests(incomingRequests);
      setOutgoingPendingRequests(data.outgoingPendingRequests ?? []);
      setFriends(data.friends ?? []);

      markIncomingFriendRequestsAsSeen(incomingRequests.map((request) => request.friendshipId));
      window.dispatchEvent(new Event("friends:changed"));
    } catch {
      setListError("No se pudieron cargar tus amigos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFriendsData();
  }, []);

  // Autocompletado: busca usuarios por username mientras se escribe (debounced).
  useEffect(() => {
    const query = usernameQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
        const data = (await response.json().catch(() => ({}))) as { results?: UserSuggestion[] };
        if (response.ok && Array.isArray(data.results)) {
          setSuggestions(data.results);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [usernameQuery]);

  const sendRequest = async (rawUsername: string) => {
    setRequestError(null);
    setRequestSuccess(null);

    const username = rawUsername.trim();
    if (!username) {
      setRequestError("Escribe un username para enviar la solicitud.");
      return;
    }

    setSending(true);
    setShowSuggestions(false);

    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setRequestError(data.message ?? "No se pudo enviar la solicitud.");
        return;
      }

      setRequestSuccess(data.message ?? "Solicitud enviada correctamente.");
      setUsernameQuery("");
      setSuggestions([]);
      await loadFriendsData();
      window.dispatchEvent(new Event("friends:changed"));
    } catch {
      setRequestError("No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  };

  const handleSendRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendRequest(usernameQuery);
  };

  const handleRespond = async (friendshipId: number, action: "accept" | "reject") => {
    setRequestError(null);
    setRequestSuccess(null);
    setRespondingId(friendshipId);

    try {
      const response = await fetch("/api/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendshipId, action }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setRequestError(data.message ?? "No se pudo responder la solicitud.");
        return;
      }

      setRequestSuccess(data.message ?? "Solicitud actualizada.");
      await loadFriendsData();
      window.dispatchEvent(new Event("friends:changed"));
    } catch {
      setRequestError("No se pudo responder la solicitud.");
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancelOutgoingRequest = async (friendshipId: number) => {
    setRequestError(null);
    setRequestSuccess(null);
    setCancelingRequestId(friendshipId);

    try {
      const response = await fetch("/api/friends/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendshipId }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setRequestError(data.message ?? "No se pudo cancelar la solicitud.");
        return;
      }

      setRequestSuccess(data.message ?? "Solicitud cancelada.");
      await loadFriendsData();
      window.dispatchEvent(new Event("friends:changed"));
    } catch {
      setRequestError("No se pudo cancelar la solicitud.");
    } finally {
      setCancelingRequestId(null);
    }
  };

  const handleDeleteFriend = async (friendshipId: number) => {
    setRequestError(null);
    setRequestSuccess(null);

    const shouldDelete = window.confirm("¿Seguro que quieres borrar esta amistad?");
    if (!shouldDelete) {
      return;
    }

    setDeletingFriendshipId(friendshipId);

    try {
      const response = await fetch("/api/friends/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendshipId }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setRequestError(data.message ?? "No se pudo borrar la amistad.");
        return;
      }

      setRequestSuccess(data.message ?? "Amistad eliminada.");
      await loadFriendsData();
      window.dispatchEvent(new Event("friends:changed"));
    } catch {
      setRequestError("No se pudo borrar la amistad.");
    } finally {
      setDeletingFriendshipId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Amigos" subtitle="Las personas con las que compartes tu diario" />

      <form className="mb-10 space-y-2" onSubmit={handleSendRequest} autoComplete="off">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Escribe el username para enviar solicitud…"
            className="h-12 rounded-2xl border-border bg-cream/60 pl-11 pr-32"
            value={usernameQuery}
            onChange={(event) => {
              setUsernameQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
            maxLength={80}
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-full px-4"
            disabled={sending}
          >
            {sending ? "Enviando..." : "Enviar"}
          </Button>

          {showSuggestions && usernameQuery.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-14 z-20 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              {searchingUsers && suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Buscando…</p>
              ) : suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Sin coincidencias.</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-1">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.userId}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => void sendRequest(suggestion.username)}
                        disabled={sending}
                      >
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground">
                          {suggestion.username.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{suggestion.username}</span>
                          <span className="block truncate text-xs text-muted-foreground">@{suggestion.username}</span>
                        </span>
                        <span className="text-xs font-medium text-primary">Enviar</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {requestError ? <p className="text-sm text-red-500">{requestError}</p> : null}
        {requestSuccess ? <p className="text-sm text-green-600">{requestSuccess}</p> : null}
      {listError ? <p className="text-sm text-red-500">{listError}</p> : null}
      </form>

      {!loading && pendingRequests.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Solicitudes pendientes
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((req, i) => (
              <motion.div
                key={req.friendshipId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="paper-card flex items-center justify-between rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground">
                    {toDisplayName(req.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{toDisplayName(req.username)}</p>
                    <p className="text-xs text-muted-foreground">@{req.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 rounded-full"
                    onClick={() => void handleRespond(req.friendshipId, "reject")}
                    disabled={respondingId === req.friendshipId}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-9 w-9 rounded-full bg-primary"
                    onClick={() => void handleRespond(req.friendshipId, "accept")}
                    disabled={respondingId === req.friendshipId}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {!loading && outgoingPendingRequests.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Solicitudes enviadas
          </h2>
          <div className="space-y-3">
            {outgoingPendingRequests.map((req, i) => (
              <motion.div
                key={req.friendshipId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="paper-card flex items-center justify-between rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground">
                    {toDisplayName(req.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{toDisplayName(req.username)}</p>
                    <p className="text-xs text-muted-foreground">@{req.username}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void handleCancelOutgoingRequest(req.friendshipId)}
                  disabled={cancelingRequestId === req.friendshipId}
                >
                  Cancelar
                </Button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tus amigos · {friends.length}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {friends.map((f, i) => (
            <motion.div
              key={f.userId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="paper-card flex items-center gap-3 rounded-2xl p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-olive to-mint font-medium text-cream">
                {toInitials(f.username)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{toDisplayName(f.username)}</p>
                <p className="truncate text-xs text-muted-foreground">@{f.username}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-muted-foreground"
                title="Borrar amistad"
                onClick={() => void handleDeleteFriend(f.friendshipId)}
                disabled={deletingFriendshipId === f.friendshipId}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>

        {!loading && friends.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aún no tienes amigos agregados.</p>
        ) : null}
      </section>
    </div>
  );
}
