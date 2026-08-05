"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { readSessionCookie, sessionExpiry, setSessionCookie, clearSessionCookie } from "@/lib/server/session";
import { cleanName, emailError, nameError, normaliseEmail, passwordError } from "@/lib/validate";

export type AuthState = { error?: string; field?: "email" | "password" | "name" } | undefined;

/**
 * Where to land after signing in. Only same-site absolute paths are honoured —
 * `//evil.example` and `https://evil.example` are both valid `new URL` inputs
 * and would turn the login form into an open redirect.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string") return "/studio";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/studio";
  return raw;
}

async function requestContext() {
  const head = await headers();
  return {
    userAgent: head.get("user-agent")?.slice(0, 300) ?? null,
    // Behind a proxy the first hop is the client; direct connections have neither header.
    ip: head.get("x-forwarded-for")?.split(",")[0]?.trim() ?? head.get("x-real-ip") ?? null,
  };
}

async function startSession(userId: string, role: "USER" | "ADMIN" | "SUPERADMIN") {
  const expiresAt = sessionExpiry();
  const { userAgent, ip } = await requestContext();
  const session = await db.session.create({
    data: { userId, expiresAt, userAgent, ip },
    select: { id: true },
  });
  await setSessionCookie({ sessionId: session.id, userId, role }, expiresAt);
}

export async function signup(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = normaliseEmail(formData.get("email"));
  const password = formData.get("password");
  const name = cleanName(formData.get("name"));

  const emailProblem = emailError(email);
  if (emailProblem) return { error: emailProblem, field: "email" };
  const nameProblem = nameError(name);
  if (nameProblem) return { error: nameProblem, field: "name" };
  const passwordProblem = passwordError(password);
  if (passwordProblem) return { error: passwordProblem, field: "password" };

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "Аккаунт с такой почтой уже существует.", field: "email" };
  }

  const user = await db.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password as string),
    },
    select: { id: true, role: true },
  });

  await startSession(user.id, user.role);
  redirect(safeNext(formData.get("keyin")));
}

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = normaliseEmail(formData.get("email"));
  const password = formData.get("password");

  if (!email || typeof password !== "string" || !password) {
    return { error: "Введите почту и пароль." };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true, blocked: true },
  });

  // Same message and roughly the same work either way, so the response cannot be
  // used to find out which addresses are registered.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return { error: "Неверная почта или пароль." };
  }
  if (user.blocked) {
    return { error: "Этот аккаунт заблокирован. Обратитесь в поддержку." };
  }

  await startSession(user.id, user.role);
  redirect(safeNext(formData.get("keyin")));
}

export async function logout(): Promise<void> {
  const payload = await readSessionCookie();
  if (payload) {
    // Revoke rather than delete: the row is the only record of when and from
    // where the session was used, which is worth keeping.
    await db.session.updateMany({
      where: { id: payload.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookie();
  redirect("/");
}
