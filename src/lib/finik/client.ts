import "server-only";

import { canonicalBody, sign, type SignableRequest } from "./signer";
import { getFinikConfig, type FinikConfig } from "./config";

const PATH = "/v1/payment";

export type CreatePaymentInput = {
  /** Our own reference; comes back in the webhook as `fields.paymentId`. */
  reference: string;
  amountSom: number;
  /** Shown on the Finik payment page. */
  name: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
};

export type CreatePaymentResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string };

/**
 * Creates a payment and returns the URL to send the customer to.
 *
 * Finik answers with a 302 whose `Location` is the payment page, so redirects
 * must not be followed — `fetch` would happily chase it and hand back the HTML
 * of the payment page with the URL lost.
 */
export async function createPayment(
  input: CreatePaymentInput,
  config: FinikConfig | null = getFinikConfig(),
): Promise<CreatePaymentResult> {
  if (!config) return { ok: false, error: "Finik не настроен." };

  const timestamp = String(Date.now());
  const body = {
    Amount: input.amountSom,
    CardType: "FINIK_QR",
    PaymentId: input.reference,
    RedirectUrl: input.redirectUrl,
    Data: {
      accountId: config.accountId,
      name_en: input.name,
      webhookUrl: input.webhookUrl,
      description: input.description,
    },
  };

  const request: SignableRequest = {
    method: "POST",
    path: PATH,
    headers: {
      host: config.host,
      "x-api-key": config.apiKey,
      "x-api-timestamp": timestamp,
    },
    body,
  };

  // Sign and send the *same* string: re-stringifying could reorder keys and the
  // signature would no longer describe what actually arrives.
  const payload = canonicalBody(body);
  const signature = sign(request, config.privateKey);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${PATH}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        signature,
        "x-api-key": config.apiKey,
        "x-api-timestamp": timestamp,
      },
      body: payload,
    });
  } catch (error) {
    return { ok: false, error: `Не удалось связаться с Finik: ${String(error)}` };
  }

  const location = response.headers.get("location");
  if (location) return { ok: true, paymentUrl: location };

  const text = await response.text().catch(() => "");
  let message = `Finik ${response.status} qaytardi.`;
  try {
    const parsed = JSON.parse(text) as { ErrorMessage?: string };
    if (parsed.ErrorMessage) message = parsed.ErrorMessage;
  } catch {
    if (text) message = text.slice(0, 200);
  }
  return { ok: false, error: message };
}
