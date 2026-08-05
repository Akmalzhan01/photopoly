/**
 * Small hand-rolled validators.
 *
 * Everything the forms need is a trim, a length check and one regex, which is
 * not worth a schema library — and keeping them dependency-free means the same
 * functions run in a plain Node test with no build step.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

/** Deliberately permissive: the only real proof an address works is mail sent to it. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function emailError(email: string): string | null {
  if (!email) return "Введите электронную почту.";
  if (email.length > 254) return "Адрес почты слишком длинный.";
  if (!EMAIL.test(email)) return "Неверный формат электронной почты.";
  return null;
}

export function passwordError(password: unknown): string | null {
  if (typeof password !== "string" || !password) return "Введите пароль.";
  if (password.length < MIN_PASSWORD) return `Пароль должен быть не короче ${MIN_PASSWORD} символов.`;
  if (password.length > MAX_PASSWORD) return "Пароль слишком длинный.";
  return null;
}

export function nameError(name: string): string | null {
  if (name.length > 80) return "Имя слишком длинное.";
  return null;
}

export function cleanName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}
