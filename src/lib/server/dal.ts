import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { db } from "./db";
import { LOGIN_PATH, readSessionCookie } from "./session";

/** Only ever the fields a page actually needs — never the password hash. */
export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
};

/**
 * The one place that answers "who is this request from".
 *
 * Every call hits the database rather than trusting the cookie, so revoking a
 * session or blocking a user takes effect on their very next request. `cache()`
 * collapses the repeated calls within a single render into one query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const payload = await readSessionCookie();
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: { id: true, email: true, name: true, role: true, blocked: true, createdAt: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const { blocked, ...user } = session.user;
  if (blocked) return null;

  return user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // The marker matters: a server component cannot clear a cookie, so it has to
  // tell the proxy that this apparently-valid session is in fact dead.
  if (!user) redirect(LOGIN_PATH);
  return user;
}

const ADMIN_ROLES: Role[] = ["ADMIN", "SUPERADMIN"];

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  // Deliberately the same destination as "not logged in": an unauthorised
  // visitor learns nothing about whether /admin exists.
  if (!ADMIN_ROLES.includes(user.role)) redirect("/");
  return user;
}

export async function requireSuperadmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "SUPERADMIN") redirect("/");
  return user;
}

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}
