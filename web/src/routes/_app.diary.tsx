import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { DiaryEntryPreview } from "@/components/diary/DiaryEntryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiaryBook } from "@/components/diary/DiaryBook";
import { useCurrentUser } from "@/lib/current-user";

export const Route = createFileRoute("/_app/diary")({
  validateSearch: (search: Record<string, unknown>) => {
    const date = typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
      ? search.date
      : undefined;

    const entryId = typeof search.entryId === "string" && search.entryId.trim()
      ? search.entryId.trim()
      : undefined;

    return { date, entryId };
  },
  component: DiaryPage,
});

type DiaryApiEntry = {
  id: string | number;
  title: string | null;
  content: string;
  entry_date: string;
  song_title: string | null;
  song_artist: string | null;
  song_url: string | null;
  photo_count?: number;
  tag_count?: number;
  photo_urls?: string[] | null;
  tagged_users?: string[] | null;
  tagged_comments?: Array<{
    id: number;
    entryTagId: number;
    authorId: number;
    authorUsername: string;
    taggedUserUsername: string;
    message: string;
    createdAt: string;
  }> | null;
};

type FriendOption = {
  friendshipId: number;
  userId: number;
  username: string;
};

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function formatEntryDate(value: string) {
  if (typeof value !== "string" || !value.trim()) {
    return "Fecha inválida";
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const monthRaw = parts.find((part) => part.type === "month")?.value ?? "";
  const month = monthRaw.replace(".", "");

  if (!day || !month) {
    return value;
  }

  return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

function mapEntry(entry: DiaryApiEntry): DiaryEntryPreview {
  const title = entry.title?.trim() || "Entrada sin título";
  const excerpt = entry.content.trim();
  const songTitle = entry.song_title?.trim();
  const songArtist = entry.song_artist?.trim();
  const songUrl = entry.song_url?.trim();
  const photoUrls = (entry.photo_urls ?? []).filter(
    (url): url is string => typeof url === "string" && isHttpUrl(url),
  );

  return {
    id: String(entry.id),
    title,
    excerpt,
    date: formatEntryDate(entry.entry_date),
    photoCount: entry.photo_count && entry.photo_count > 0 ? entry.photo_count : undefined,
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    tagCount: entry.tag_count && entry.tag_count > 0 ? entry.tag_count : undefined,
    taggedUsers: (entry.tagged_users ?? []).filter(
      (username): username is string => typeof username === "string" && username.trim().length > 0,
    ),
    taggedComments: (entry.tagged_comments ?? []).filter(
      (comment): comment is NonNullable<DiaryApiEntry["tagged_comments"]>[number] =>
        typeof comment === "object" && comment !== null,
    ),
    song:
      songTitle && songArtist
        ? {
            title: songTitle,
            artist: songArtist,
            ...(songUrl ? { url: songUrl } : {}),
          }
        : undefined,
  };
}

function DiaryPage() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const { date, entryId } = Route.useSearch();
  const [entries, setEntries] = useState<DiaryEntryPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rememberSaving, setRememberSaving] = useState(false);
  const [rememberMessage, setRememberMessage] = useState<string | null>(null);
  const [rememberError, setRememberError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songUrl, setSongUrl] = useState("");
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [selectedTaggedFriends, setSelectedTaggedFriends] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  const canSubmit = useMemo(() => content.trim().length > 0 && !saving, [content, saving]);

  const availableFriends = useMemo(() => {
    const selected = new Set(selectedTaggedFriends.map((username) => username.toLowerCase()));
    const query = tagSearch.trim().toLowerCase();

    return friends.filter((friend) => {
      if (selected.has(friend.username.toLowerCase())) {
        return false;
      }

      if (!query) {
        return true;
      }

      return friend.username.toLowerCase().includes(query);
    });
  }, [friends, selectedTaggedFriends, tagSearch]);

  const loadEntries = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const response = await fetch(`/api/diary${query}`);
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        entries?: DiaryApiEntry[];
      };

      if (!response.ok) {
        setErrorMessage(data.message ?? "No se pudieron cargar tus entradas.");
        return;
      }

      setEntries((data.entries ?? []).map(mapEntry));
    } catch {
      setErrorMessage("No se pudieron cargar tus entradas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, [date]);

  const loadFriends = async () => {
    setFriendsLoading(true);

    try {
      const response = await fetch("/api/friends");
      const data = (await response.json().catch(() => ({}))) as {
        friends?: FriendOption[];
      };

      if (!response.ok) {
        return;
      }

      setFriends(data.friends ?? []);
    } catch {
    } finally {
      setFriendsLoading(false);
    }
  };

  useEffect(() => {
    if (!open || friends.length > 0 || friendsLoading) {
      return;
    }

    void loadFriends();
  }, [open, friends.length, friendsLoading]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSongTitle("");
    setSongArtist("");
    setSongUrl("");
    setTagSearch("");
    setSelectedTaggedFriends([]);
    setTagPickerOpen(false);
    setPhotos([]);
    setSaveError(null);
  };

  const addTaggedFriend = (username: string) => {
    const normalized = username.trim();
    if (!normalized) {
      return;
    }

    setSelectedTaggedFriends((prev) => {
      if (prev.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }

      if (prev.length >= 10) {
        setSaveError("Puedes etiquetar hasta 10 amigos por entrada.");
        return prev;
      }

      setSaveError(null);
      return [...prev, normalized];
    });
    setTagSearch("");
    setTagPickerOpen(false);
  };

  const removeTaggedFriend = (username: string) => {
    setSelectedTaggedFriends((prev) => prev.filter((item) => item !== username));
  };

  const uploadPhoto = async (entryId: number, photo: File) => {
    const formData = new FormData();
    formData.append("entry_id", String(entryId));
    formData.append("file", photo);

    const response = await fetch("/api/diary/photos", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message ?? "No se pudo subir una foto.");
    }
  };

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(null);

    if (!content.trim()) {
      setSaveError("Escribe el contenido de tu entrada.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          song_title: songTitle,
          song_artist: songArtist,
          song_url: songUrl,
          tagged_usernames: selectedTaggedFriends,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        entry?: { id: string | number };
      };

      if (!response.ok) {
        setSaveError(data.message ?? "No se pudo crear la entrada.");
        return;
      }

      const createdEntryId = Number(data.entry?.id);
      if (Number.isInteger(createdEntryId) && createdEntryId > 0 && photos.length > 0) {
        await Promise.all(photos.map((photo) => uploadPhoto(createdEntryId, photo)));
      }

      setOpen(false);
      resetForm();
      await loadEntries();
      window.dispatchEvent(new Event("diary:changed"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear la entrada o subir las fotos.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRememberSelection = async (payload: {
    entryId: string;
    entryTitle: string;
    selectedText: string;
  }) => {
    const entryIdNumber = Number(payload.entryId);
    if (!Number.isInteger(entryIdNumber) || entryIdNumber <= 0) {
      setRememberError("No se pudo identificar la entrada seleccionada.");
      return;
    }

    setRememberSaving(true);
    setRememberError(null);
    setRememberMessage(null);

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entry_id: entryIdNumber,
          selected_text: payload.selectedText,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setRememberError(data.message ?? "No se pudo guardar el recuerdo.");
        return;
      }

      setRememberMessage(data.message ?? "Recuerdo guardado correctamente.");
    } catch {
      setRememberError("No se pudo guardar el recuerdo.");
    } finally {
      setRememberSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={currentUser?.username ? `Hola, ${currentUser.username}` : "Tu diario"}
        subtitle={
          date
            ? `Entradas del ${date}`
            : currentUser?.username
              ? "Tu diario · hoy es un buen día para escribir"
              : "Hoy es un buen día para escribir"
        }
        action={
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="h-10 rounded-full bg-primary px-5 text-sm shadow-[0_8px_24px_-8px_var(--olive)]">
                <Plus className="mr-1.5 h-4 w-4" /> Nueva entrada
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nueva entrada</DialogTitle>
                <DialogDescription>
                  La fecha se guardará automáticamente con el día actual.
                </DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleCreateEntry}>
                <div className="space-y-2">
                  <Label htmlFor="diary-title">Título (opcional)</Label>
                  <Input
                    id="diary-title"
                    placeholder="Ej: Caminata sin rumbo"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={25}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diary-content">Contenido</Label>
                  <Textarea
                    id="diary-content"
                    placeholder="querida kitty..."
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="min-h-36"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="diary-song-title">Canción (opcional)</Label>
                    <Input
                      id="diary-song-title"
                      placeholder="Título"
                      value={songTitle}
                      onChange={(event) => setSongTitle(event.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diary-song-artist">Artista (opcional)</Label>
                    <Input
                      id="diary-song-artist"
                      placeholder="Artista"
                      value={songArtist}
                      onChange={(event) => setSongArtist(event.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diary-song-url">URL canción (opcional)</Label>
                  <Input
                    id="diary-song-url"
                    placeholder="https://..."
                    value={songUrl}
                    onChange={(event) => setSongUrl(event.target.value)}
                    maxLength={500}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diary-tags">Etiquetar amigos (opcional)</Label>
                  <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start rounded-xl border-border bg-background px-3 text-left font-normal"
                      >
                        {selectedTaggedFriends.length > 0
                          ? `${selectedTaggedFriends.length} amigo(s) etiquetado(s)`
                          : "Selecciona amigos para etiquetar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar amigo por username..."
                          value={tagSearch}
                          onValueChange={setTagSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {friendsLoading ? "Cargando amigos..." : "No hay amigos que coincidan."}
                          </CommandEmpty>
                          <CommandGroup>
                            {availableFriends.map((friend) => (
                              <CommandItem
                                key={friend.userId}
                                value={friend.username}
                                onSelect={() => addTaggedFriend(friend.username)}
                              >
                                <Check className="h-4 w-4 opacity-0" />
                                @{friend.username}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedTaggedFriends.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTaggedFriends.map((username) => (
                        <Badge key={username} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                          @{username}
                          <button
                            type="button"
                            className="inline-flex items-center"
                            onClick={() => removeTaggedFriend(username)}
                            aria-label={`Quitar a ${username}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Busca y selecciona amigos aceptados para etiquetarlos en esta entrada.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diary-photos">Fotos (opcional)</Label>
                  <Input
                    id="diary-photos"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={(event) => {
                      const nextFiles = Array.from(event.target.files ?? []);

                      if (nextFiles.length > 8) {
                        setSaveError("Puedes adjuntar hasta 8 fotos por entrada.");
                        return;
                      }

                      setSaveError(null);
                      setPhotos(nextFiles);
                    }}
                  />
                  {photos.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{photos.length} foto(s) seleccionada(s).</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Formatos: JPG, PNG, WEBP o GIF. Máximo 8 MB por foto.
                    </p>
                  )}
                </div>

                {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!canSubmit}>
                    {saving ? "Guardando..." : "Guardar entrada"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {date ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-cream/50 px-4 py-2 text-sm">
          <p className="text-muted-foreground">Filtro activo por fecha: {date}</p>
          <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/diary", search: {} })}>
            Ver todo
          </Button>
        </div>
      ) : null}

      {rememberError ? <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{rememberError}</p> : null}
      {rememberMessage ? <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700">{rememberMessage}</p> : null}

      {loading ? (
        <p className="px-2 py-6 text-sm text-muted-foreground">Cargando entradas...</p>
      ) : errorMessage ? (
        <p className="px-2 py-6 text-sm text-destructive">{errorMessage}</p>
      ) : entries.length === 0 ? (
        <p className="px-2 py-6 text-sm text-muted-foreground">
          {date
            ? "No hay entradas para ese día."
            : "Todavía no tienes entradas. Crea la primera con el botón Nueva entrada."}
        </p>
      ) : (
        <DiaryBook
          entries={entries}
          initialActiveId={entryId}
          onRememberSelection={handleRememberSelection}
          rememberSaving={rememberSaving}
        />
      )}
    </div>
  );
}
