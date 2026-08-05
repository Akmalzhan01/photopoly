/**
 * Request signing for the Finik acquiring API.
 *
 * Finik authenticates every call with an RSA-SHA256 signature over a canonical
 * string built from the request. The algorithm below is a direct reimplementation
 * of Finik's own `@mancho.devs/authorizer` package, kept in-tree rather than
 * installed because it is forty lines of `node:crypto` and pulling in `node-jose`
 * for a PEM round-trip is not worth the dependency.
 *
 * The exact byte-for-byte shape matters — one wrong separator and every request
 * comes back `401 An invalid signature is provided` with no further clue, so the
 * canonical string is exposed via `canonicalString()` and covered by tests.
 */

import { createSign, createVerify } from "node:crypto";

export type SignableRequest = {
  method: string;
  /** Absolute path, no query string. */
  path: string;
  /** Must include `host`; only `host` and `x-api-*` entries take part. */
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  /**
   * Parsed body. Top-level keys are sorted before stringifying, so callers must
   * transmit exactly `canonicalBody()` — re-stringifying elsewhere can reorder
   * nested objects and silently invalidate the signature.
   */
  body?: Record<string, unknown>;
};

function headerSection(headers: SignableRequest["headers"]): string {
  const host = headers.host ?? headers.Host;
  if (!host) throw new Error("Для подписи Finik обязателен заголовок «host».");

  const apiKeys = Object.keys(headers)
    .filter((key) => key.toLowerCase().startsWith("x-api-"))
    .sort();

  const parts = [`host:${host}`];
  for (const key of apiKeys) {
    const value = headers[key];
    if (value === undefined || value === null) {
      throw new Error(`Заголовок Finik «${key}» пуст.`);
    }
    parts.push(`${key.toLowerCase()}:${value}`);
  }
  return parts.join("&");
}

function querySection(query: SignableRequest["query"]): string {
  if (!query) return "";
  return Object.keys(query)
    .sort()
    .map((key) => {
      const value = query[key] ?? "";
      return `${encodeURI(decodeURI(key))}=${encodeURI(decodeURI(value))}`;
    })
    .join("&");
}

/**
 * The body exactly as it must go on the wire: top-level keys sorted, nested
 * objects left in their declared order.
 */
export function canonicalBody(body: SignableRequest["body"]): string {
  if (!body) return "";
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(body).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = body[key];
  }
  return JSON.stringify(sorted);
}

export function canonicalString(request: SignableRequest): string {
  const parts = [
    request.method.toLowerCase(),
    decodeURI(request.path ?? ""),
    headerSection(request.headers),
  ];

  const query = querySection(request.query);
  if (query) parts.push(query);

  parts.push(canonicalBody(request.body));
  return parts.join("\n");
}

/** Base64 RSA-SHA256 signature, for the `signature` request header. */
export function sign(request: SignableRequest, privateKeyPem: string): string {
  return createSign("SHA256")
    .update(canonicalString(request))
    .sign(privateKeyPem, "base64");
}

/** Checks a signature Finik sent us — used on the webhook. Never throws. */
export function verify(
  request: SignableRequest,
  publicKeyPem: string,
  signature: string,
): boolean {
  try {
    return createVerify("SHA256")
      .update(canonicalString(request))
      .verify(publicKeyPem, signature, "base64");
  } catch {
    return false;
  }
}
