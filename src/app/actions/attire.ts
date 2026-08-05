"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { requireAdmin, type CurrentUser } from "@/lib/server/dal";
import { MAX_ATTIRE_EDGE, readPngInfo } from "@/lib/server/png";
import {
  ATTIRE_BUCKET,
  getStorageConfig,
  removeObject,
  uploadObject,
} from "@/lib/server/storage";

export type AttireState = { error?: string; done?: string } | undefined;

/** Generous for artwork, small enough that a stray photo upload is caught. */
const MAX_BYTES = 4 * 1024 * 1024;

async function record(
  actor: CurrentUser,
  action: string,
  id: string,
  meta?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: { actorId: actor.id, action, targetType: "attire", targetId: id, meta: meta as never },
  });
}

function refresh() {
  revalidatePath("/admin", "layout");
  // The studio reads the same list, so it has to drop its cached copy too.
  revalidatePath("/studio");
}

export async function uploadAttire(
  _state: AttireState,
  formData: FormData,
): Promise<AttireState> {
  const actor = await requireAdmin();

  const config = getStorageConfig();
  if (!config) {
    return { error: "Supabase Storage не настроен — задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Введите название." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите файл PNG." };
  if (file.size > MAX_BYTES) {
    return { error: `Файл слишком большой (${Math.round(file.size / 1024 / 1024)} МБ). Предел — 4 МБ.` };
  }

  const buffer = await file.arrayBuffer();
  const info = readPngInfo(new Uint8Array(buffer));
  if (!info) {
    return {
      error: `Это не настоящий PNG или он больше ${MAX_ATTIRE_EDGE} px. Нужен PNG с прозрачным фоном.`,
    };
  }

  // A random path rather than the display name: names repeat, get renamed, and
  // may contain characters that would need escaping in a URL.
  const path = `${randomUUID()}.png`;
  const uploaded = await uploadObject(config, ATTIRE_BUCKET, path, buffer, "image/png");
  if (!uploaded.ok) return { error: uploaded.error };

  const last = await db.attireAsset.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const asset = await db.attireAsset.create({
    data: {
      name,
      path,
      url: uploaded.url,
      width: info.width,
      height: info.height,
      bytes: file.size,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
    select: { id: true },
  });

  await record(actor, "attire.upload", asset.id, { name, width: info.width, height: info.height });
  refresh();
  return { done: `«${name}» добавлен.` };
}

export async function setAttireActive(
  _state: AttireState,
  formData: FormData,
): Promise<AttireState> {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";

  const asset = await db.attireAsset.findUnique({ where: { id }, select: { name: true } });
  if (!asset) return { error: "Костюм не найден." };

  await db.attireAsset.update({ where: { id }, data: { active } });
  await record(actor, active ? "attire.show" : "attire.hide", id, { name: asset.name });
  refresh();
  return { done: active ? `«${asset.name}» теперь виден.` : `«${asset.name}» скрыт.` };
}

export async function renameAttire(
  _state: AttireState,
  formData: FormData,
): Promise<AttireState> {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Название не может быть пустым." };

  const asset = await db.attireAsset.findUnique({ where: { id }, select: { name: true } });
  if (!asset) return { error: "Костюм не найден." };

  await db.attireAsset.update({ where: { id }, data: { name } });
  await record(actor, "attire.rename", id, { from: asset.name, to: name });
  refresh();
  return { done: "Название изменено." };
}

export async function deleteAttire(
  _state: AttireState,
  formData: FormData,
): Promise<AttireState> {
  const actor = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const asset = await db.attireAsset.findUnique({
    where: { id },
    select: { name: true, path: true },
  });
  if (!asset) return { error: "Костюм не найден." };

  // Row first: an orphaned storage object is invisible clutter, whereas a row
  // pointing at a deleted object would show the studio a broken image.
  await db.attireAsset.delete({ where: { id } });

  const config = getStorageConfig();
  if (config) await removeObject(config, ATTIRE_BUCKET, asset.path);

  await record(actor, "attire.delete", id, { name: asset.name });
  refresh();
  return { done: `«${asset.name}» удалён.` };
}
