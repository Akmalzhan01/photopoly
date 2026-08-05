import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "photopoly_session";
const SESSION_DAYS = 30;

/**
 * Marks a login page reached because the database rejected a session whose
 * cookie still parses — revoked, or belonging to a blocked user.
 *
 * Without it the two layers deadlock: the proxy sees a valid-looking cookie and
 * sends the visitor to the studio, the studio asks the database and sends them
 * back to the login page, forever. The marker tells the proxy to stand down and
 * bin the cookie instead.
 */
export const STALE_SESSION_PARAM = "sessiya";
export const LOGIN_PATH = `/kirish?${STALE_SESSION_PARAM}=tugadi`;

/**
 * What travels in the cookie.
 *
 * `role` is a convenience for the optimistic redirect in `proxy.ts` and for
 * hiding UI — never trust it for anything that matters. Authorisation that has
 * consequences reads the database through the DAL.
 */
export type SessionPayload = {
  sessionId: string;
  userId: string;
  role: Role;
};

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET не задан.");
  return new TextEncoder().encode(secret);
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function encodeSession(payload: SessionPayload, expiresAt: Date): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key());
}

export async function decodeSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { sessionId, userId, role } = payload as Record<string, unknown>;
    if (typeof sessionId !== "string" || typeof userId !== "string" || typeof role !== "string") {
      return null;
    }
    return { sessionId, userId, role: role as Role };
  } catch {
    // Expired, tampered with, or signed by a secret we have since rotated.
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encodeSession(payload, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}
