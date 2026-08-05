import "server-only";

/**
 * Finik credentials, read once per process.
 *
 * When the API key or either RSA key is missing the app does not fall over — it
 * drops to MANUAL mode, where an order is still recorded and an admin activates
 * it by hand. That keeps the whole purchase flow testable before the merchant
 * account exists, which for a Kyrgyz legal entity can take days.
 */

export const FINIK_HOSTS = {
  production: "api.acquiring.averspay.kg",
  beta: "beta.api.acquiring.averspay.kg",
} as const;

export type FinikConfig = {
  apiKey: string;
  accountId: string;
  privateKey: string;
  publicKey: string;
  host: string;
  baseUrl: string;
};

/** Env holds PEMs base64-encoded, because a PEM has newlines and .env does not. */
function decodePem(raw: string | undefined): string {
  if (!raw) return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("-----BEGIN")) return value.replace(/\\n/g, "\n");
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function getFinikConfig(): FinikConfig | null {
  const apiKey = process.env.FINIK_API_KEY?.trim() ?? "";
  const accountId = process.env.FINIK_ACCOUNT_ID?.trim() ?? "";
  const privateKey = decodePem(process.env.FINIK_PRIVATE_KEY);
  const publicKey = decodePem(process.env.FINIK_PUBLIC_KEY);

  if (!apiKey || !accountId || !privateKey) return null;

  const host = process.env.FINIK_ENV === "production" ? FINIK_HOSTS.production : FINIK_HOSTS.beta;
  return { apiKey, accountId, privateKey, publicKey, host, baseUrl: `https://${host}` };
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
