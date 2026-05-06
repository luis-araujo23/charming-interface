import { randomUUID } from "node:crypto";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function validateDiaryPhotoFile(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG, WEBP o GIF.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera el límite de 8 MB.");
  }
}

type UploadDiaryPhotoArgs = {
  file: File;
  userId: number;
  entryId: number;
};

export async function uploadDiaryPhotoToSupabase({
  file,
  userId,
  entryId,
}: UploadDiaryPhotoArgs) {
  const supabaseUrl = readEnv("SUPABASE_URL").replace(/\/$/, "");
  const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "diary-photos";

  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null;
  const safeExtension = extension && extension.length <= 8 ? extension : "jpg";
  const objectPath = `users/${userId}/entries/${entryId}/${Date.now()}-${randomUUID()}.${safeExtension}`;

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      apikey: supabaseServiceRoleKey,
      "Content-Type": file.type,
      "x-upsert": "false",
    },
    body: fileBytes,
  });

  const payload = (await uploadResponse.json().catch(() => ({}))) as {
    Key?: string;
    key?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!uploadResponse.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? "No se pudo subir la imagen al storage.");
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}
