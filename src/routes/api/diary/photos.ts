import { createFileRoute } from "@tanstack/react-router";
import { parseCookies, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-session";
import { getDbPool } from "@/lib/db";
import { uploadDiaryPhotoToSupabase, validateDiaryPhotoFile } from "@/lib/photo-storage";

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

function getEntryId(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export const Route = createFileRoute("/api/diary/photos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = getSessionUserId(request);

        if (!userId) {
          return Response.json({ message: "No autenticado" }, { status: 401 });
        }

        let formData: FormData;

        try {
          formData = await request.formData();
        } catch {
          return Response.json({ message: "Formulario inválido" }, { status: 400 });
        }

        const entryId = getEntryId(formData.get("entry_id"));
        const file = formData.get("file");

        if (!entryId) {
          return Response.json({ message: "entry_id inválido" }, { status: 400 });
        }

        if (!(file instanceof File)) {
          return Response.json({ message: "Debes enviar una imagen" }, { status: 400 });
        }

        try {
          validateDiaryPhotoFile(file);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Imagen inválida";
          return Response.json({ message }, { status: 400 });
        }

        try {
          const db = getDbPool();
          const ownerCheck = await db.query<{ id: number }>(
            `
              SELECT id
              FROM public.diary_entries
              WHERE id = $1 AND user_id = $2
              LIMIT 1
            `,
            [entryId, userId],
          );

          if (ownerCheck.rowCount === 0) {
            return Response.json({ message: "No tienes permisos sobre esta entrada" }, { status: 403 });
          }

          const photoUrl = await uploadDiaryPhotoToSupabase({
            file,
            userId,
            entryId,
          });

          const insertResult = await db.query<{
            id: number;
            entry_id: number;
            photo_url: string;
            created_at: string;
          }>(
            `
              INSERT INTO public.entry_photos (entry_id, photo_url)
              VALUES ($1, $2)
              RETURNING id, entry_id, photo_url, created_at
            `,
            [entryId, photoUrl],
          );

          return Response.json(
            {
              message: "Foto adjuntada correctamente",
              photo: insertResult.rows[0],
            },
            { status: 201 },
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("not configured")) {
            return Response.json(
              {
                message: "Falta configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
              },
              { status: 500 },
            );
          }

          console.error("Diary photos API error", error);
          return Response.json({ message: "No se pudo adjuntar la foto" }, { status: 500 });
        }
      },
    },
  },
});
