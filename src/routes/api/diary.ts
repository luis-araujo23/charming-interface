import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getSupabaseAdmin, isSupabaseEnvError } from "@/lib/supabase";

type CreateDiaryPayload = {
  title?: unknown;
  content?: unknown;
  song_title?: unknown;
  song_artist?: unknown;
  song_url?: unknown;
  tagged_usernames?: unknown;
};

function getSessionUserId(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = verifySessionToken(token);
  if (!session) {
    return null;
  }

  const userIdNumber = Number(session.userId);
  if (!Number.isFinite(userIdNumber)) {
    return null;
  }

  return userIdNumber;
}

function asNullableTrimmed(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseTaggedUsernames(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter(Boolean),
    )];
  }

  if (typeof value === "string") {
    return [...new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  return [] as string[];
}

function getWeekBoundsForDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() - offset);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  return {
    weekStartDate: weekStart.toISOString().slice(0, 10),
    weekEndDate: weekEnd.toISOString().slice(0, 10),
  };
}

export const Route = createFileRoute("/api/diary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        const url = new URL(request.url);
        const dateFilter = url.searchParams.get("date");

        if (dateFilter && !isIsoDate(dateFilter)) {
          return Response.json({ message: "La fecha debe tener formato YYYY-MM-DD." }, { status: 400 });
        }

        try {
          const supabase = getSupabaseAdmin();
          let entriesQuery = supabase
            .from("diary_entries")
            .select("id, title, content, entry_date, song_title, song_artist, song_url, created_at")
            .eq("user_id", userId)
            .order("entry_date", { ascending: false })
            .order("created_at", { ascending: false });

          if (dateFilter) {
            entriesQuery = entriesQuery.eq("entry_date", dateFilter);
          }

          const { data: entries, error: entriesError } = await entriesQuery;

          if (entriesError) {
            throw entriesError;
          }

          const entryIds = (entries ?? []).map((row) => Number(row.id));

          let photoUrlsByEntryId = new Map<number, string[]>();
          if (entryIds.length > 0) {
            const { data: photos, error: photosError } = await supabase
              .from("entry_photos")
              .select("entry_id, photo_url, created_at")
              .in("entry_id", entryIds)
              .order("created_at", { ascending: false });

            if (photosError) {
              throw photosError;
            }

            photoUrlsByEntryId = (photos ?? []).reduce((acc, row) => {
              const entryId = Number(row.entry_id);
              const current = acc.get(entryId) ?? [];
              current.push(row.photo_url);
              acc.set(entryId, current);
              return acc;
            }, new Map<number, string[]>());
          }

          const taggedUsersByEntryId = new Map<number, string[]>();
          const tagCommentsByEntryId = new Map<
            number,
            Array<{
              id: number;
              entryTagId: number;
              authorId: number;
              authorUsername: string;
              taggedUserUsername: string;
              message: string;
              createdAt: string;
            }>
          >();

          if (entryIds.length > 0) {
            const { data: tags, error: tagsError } = await supabase
              .from("entry_tags")
              .select("id, entry_id, tagged_user_id, created_at")
              .in("entry_id", entryIds)
              .order("created_at", { ascending: true });

            if (tagsError) {
              throw tagsError;
            }

            const entryTagIds = (tags ?? []).map((row) => Number(row.id));
            const taggedUserIds = [...new Set((tags ?? []).map((row) => Number(row.tagged_user_id)))];

            const { data: taggedUsers, error: taggedUsersError } = taggedUserIds.length > 0
              ? await supabase.from("users").select("id, username").in("id", taggedUserIds)
              : { data: [], error: null };

            if (taggedUsersError) {
              throw taggedUsersError;
            }

            const taggedUsernamesById = new Map((taggedUsers ?? []).map((row) => [Number(row.id), row.username]));
            const entryIdByEntryTagId = new Map<number, number>();
            const taggedUserByEntryTagId = new Map<number, string>();

            for (const tag of tags ?? []) {
              const entryId = Number(tag.entry_id);
              const entryTagId = Number(tag.id);
              const taggedUsername = taggedUsernamesById.get(Number(tag.tagged_user_id)) ?? "";
              const currentTaggedUsers = taggedUsersByEntryId.get(entryId) ?? [];
              currentTaggedUsers.push(taggedUsername);
              taggedUsersByEntryId.set(entryId, currentTaggedUsers);
              entryIdByEntryTagId.set(entryTagId, entryId);
              taggedUserByEntryTagId.set(entryTagId, taggedUsername);
            }

            if (entryTagIds.length > 0) {
              const { data: comments, error: commentsError } = await supabase
                .from("tagged_entry_messages")
                .select("id, entry_tag_id, author_id, message, created_at")
                .in("entry_tag_id", entryTagIds)
                .order("created_at", { ascending: true });

              if (commentsError) {
                throw commentsError;
              }

              const authorIds = [...new Set((comments ?? []).map((row) => Number(row.author_id)))];
              const { data: authors, error: authorsError } = authorIds.length > 0
                ? await supabase.from("users").select("id, username").in("id", authorIds)
                : { data: [], error: null };

              if (authorsError) {
                throw authorsError;
              }

              const authorUsernamesById = new Map((authors ?? []).map((row) => [Number(row.id), row.username]));

              for (const comment of comments ?? []) {
                const entryTagId = Number(comment.entry_tag_id);
                const entryId = entryIdByEntryTagId.get(entryTagId);

                if (!entryId) {
                  continue;
                }

                const currentComments = tagCommentsByEntryId.get(entryId) ?? [];
                currentComments.push({
                  id: Number(comment.id),
                  entryTagId,
                  authorId: Number(comment.author_id),
                  authorUsername: authorUsernamesById.get(Number(comment.author_id)) ?? "",
                  taggedUserUsername: taggedUserByEntryTagId.get(entryTagId) ?? "",
                  message: comment.message,
                  createdAt: comment.created_at,
                });
                tagCommentsByEntryId.set(entryId, currentComments);
              }
            }
          }

          return Response.json(
            {
              entries: (entries ?? []).map((row) => {
                const entryId = Number(row.id);
                const photoUrls = photoUrlsByEntryId.get(entryId) ?? [];
                const taggedUsers = taggedUsersByEntryId.get(entryId) ?? [];

                return {
                  ...row,
                  photo_count: photoUrls.length,
                  tag_count: taggedUsers.length,
                  photo_urls: photoUrls,
                  tagged_users: taggedUsers,
                  tagged_comments: tagCommentsByEntryId.get(entryId) ?? [],
                };
              }),
            },
            { status: 200 },
          );
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Diary list API error", error);
          return Response.json({ message: "No se pudieron cargar las entradas" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let payload: CreateDiaryPayload;

        try {
          payload = (await request.json()) as CreateDiaryPayload;
        } catch {
          return Response.json({ message: "JSON inválido" }, { status: 400 });
        }

        const title = asNullableTrimmed(payload.title);
        const content = asNullableTrimmed(payload.content);
        const songTitle = asNullableTrimmed(payload.song_title);
        const songArtist = asNullableTrimmed(payload.song_artist);
        const songUrl = asNullableTrimmed(payload.song_url);
        const taggedUsernames = parseTaggedUsernames(payload.tagged_usernames);

        if (!content) {
          return Response.json({ message: "El contenido de la entrada es obligatorio." }, { status: 400 });
        }

        if (title && title.length > 25) {
          return Response.json({ message: "El título puede tener máximo 25 caracteres." }, { status: 400 });
        }

        if (taggedUsernames.length > 10) {
          return Response.json({ message: "Puedes etiquetar hasta 10 usuarios por entrada." }, { status: 400 });
        }

        try {
          const supabase = getSupabaseAdmin();

          const validTargets: Array<{ id: number; username: string }> = [];
          const invalidUsernames: string[] = [];

          for (const username of taggedUsernames) {
            const { data: targetUser, error: targetUserError } = await supabase
              .from("users")
              .select("id, username")
              .ilike("username", username)
              .limit(1)
              .maybeSingle();

            if (targetUserError) {
              throw targetUserError;
            }

            if (!targetUser) {
              invalidUsernames.push(username);
              continue;
            }

            const targetUserId = Number(targetUser.id);
            if (targetUserId === userId) {
              invalidUsernames.push(username);
              continue;
            }

            const { data: friendship, error: friendshipError } = await supabase
              .from("friendships")
              .select("id")
              .eq("status", "accepted")
              .in("requester_id", [userId, targetUserId])
              .in("addressee_id", [userId, targetUserId])
              .limit(1)
              .maybeSingle();

            if (friendshipError) {
              throw friendshipError;
            }

            if (!friendship) {
              invalidUsernames.push(username);
              continue;
            }

            validTargets.push({ id: targetUserId, username: targetUser.username });
          }

          if (invalidUsernames.length > 0) {
            return Response.json(
              {
                message:
                  `No puedes etiquetar estos usuarios (deben existir y ser amigos aceptados): ${invalidUsernames.join(", ")}`,
              },
              { status: 400 },
            );
          }

          const { data: createdEntry, error: createEntryError } = await supabase
            .from("diary_entries")
            .insert({
              user_id: userId,
              title,
              content,
              song_title: songTitle,
              song_artist: songArtist,
              song_url: songUrl,
            })
            .select("id, title, content, entry_date, song_title, song_artist, song_url, created_at")
            .single();

          if (createEntryError) {
            throw createEntryError;
          }

          const createdEntryId = Number(createdEntry.id);

          if (validTargets.length > 0) {
            const { error: tagsInsertError } = await supabase.from("entry_tags").upsert(
              validTargets.map((target) => ({
                entry_id: createdEntryId,
                tagged_user_id: target.id,
                tagged_by_user_id: userId,
              })),
              { onConflict: "entry_id,tagged_user_id", ignoreDuplicates: true },
            );

            if (tagsInsertError) {
              throw tagsInsertError;
            }
          }

          const { weekStartDate, weekEndDate } = getWeekBoundsForDate(createdEntry.entry_date);
          const { data: weekEntries, error: weekEntriesError } = await supabase
            .from("diary_entries")
            .select("entry_date")
            .eq("user_id", userId)
            .gte("entry_date", weekStartDate)
            .lte("entry_date", weekEndDate);

          if (weekEntriesError) {
            throw weekEntriesError;
          }

          const daysWritten = new Set((weekEntries ?? []).map((row) => row.entry_date)).size;
          const { error: streakError } = await supabase
            .from("weekly_streaks")
            .upsert(
              {
                user_id: userId,
                week_start_date: weekStartDate,
                week_end_date: weekEndDate,
                days_written: daysWritten,
                completed: daysWritten === 7,
              },
              { onConflict: "user_id,week_start_date" },
            );

          if (streakError) {
            throw streakError;
          }

          return Response.json(
            {
              message: "Entrada creada correctamente",
              entry: createdEntry,
            },
            { status: 201 },
          );
        } catch (error) {
          if (isSupabaseEnvError(error)) {
            return Response.json(
              { message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el archivo .env." },
              { status: 500 },
            );
          }

          console.error("Diary create API error", error);
          return Response.json({ message: "No se pudo crear la entrada" }, { status: 500 });
        }
      },
    },
  },
});
