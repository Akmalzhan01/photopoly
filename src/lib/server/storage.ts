import "server-only";

/**
 * Supabase Storage, spoken to over its REST API rather than through
 * `@supabase/supabase-js`.
 *
 * The SDK would pull in a websocket client, a Postgrest client and an auth
 * client for the sake of two HTTP calls, none of which this app uses — it talks
 * to Postgres through Prisma and handles its own sessions. Two `fetch` calls
 * are the whole surface.
 *
 * The service role key used here bypasses every row-level security rule, so it
 * must never reach the browser. Everything in this file is server-only and the
 * key is read from the environment at call time, never baked into a bundle.
 */

export const ATTIRE_BUCKET = "kostyum";

export type StorageConfig = { url: string; serviceKey: string };

/** Null when unconfigured, which the admin page reports rather than crashing. */
export function getStorageConfig(): StorageConfig | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

/** The CDN address a browser fetches. Only valid for a public bucket. */
export function publicUrl(config: StorageConfig, bucket: string, path: string): string {
  return `${config.url}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}

function authHeaders(config: StorageConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.serviceKey}`,
    apikey: config.serviceKey,
  };
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Uploads bytes, replacing whatever is already at `path`.
 *
 * `upsert` matters because a retry after a half-failed upload would otherwise
 * hit "Duplicate" forever and the admin would have no way out from the UI.
 */
export async function uploadObject(
  config: StorageConfig,
  bucket: string,
  path: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<UploadResult> {
  let response: Response;
  try {
    response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
      method: "POST",
      headers: {
        ...authHeaders(config),
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "max-age=31536000",
      },
      body,
    });
  } catch (cause) {
    return { ok: false, error: `Не удалось подключиться к Storage: ${String(cause)}` };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // Matched on the body, not the status: Supabase answers a missing bucket
    // with HTTP 400 whose JSON says 404, so keying off the status alone showed
    // the admin a raw JSON blob for the one failure they can actually fix.
    if (detail.includes("NoSuchBucket") || detail.includes("Bucket not found")) {
      return {
        ok: false,
        error: `В Supabase не создан public-bucket с именем «${bucket}».`,
      };
    }
    if (detail.includes("mime type") || detail.includes("InvalidMimeType")) {
      return { ok: false, error: "Этот bucket принимает только PNG." };
    }
    return { ok: false, error: `Ошибка Storage (${response.status}): ${detail.slice(0, 200)}` };
  }

  return { ok: true, url: publicUrl(config, bucket, path) };
}

/** Best effort: a storage object left behind is untidy, not dangerous. */
export async function removeObject(
  config: StorageConfig,
  bucket: string,
  path: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${config.url}/storage/v1/object/${bucket}/${encodeURI(path)}`,
      { method: "DELETE", headers: authHeaders(config) },
    );
    return response.ok;
  } catch {
    return false;
  }
}
