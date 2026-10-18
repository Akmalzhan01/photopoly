import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { activatePayment } from "@/lib/server/billing";
import { getFinikConfig } from "@/lib/finik/config";
import { verify, type SignableRequest } from "@/lib/finik/signer";

/**
 * Finik payment notifications.
 *
 * This endpoint is the only thing standing between a stranger and a free
 * subscription, so it refuses everything it cannot prove: no public key
 * configured means no webhooks accepted, full stop. An unverified body here
 * would be a licence to print subscriptions.
 */

export const dynamic = "force-dynamic";

/**
 * Finik's own documentation suggests refusing anything older than five minutes,
 * and a fresh notification is indeed never older than that. But Finik retries a
 * failed delivery for a full day — doubling the interval up to once every 24
 * hours — and nothing in the documentation promises a *new* timestamp on a
 * retry. Refusing a late delivery outright would mean a customer who paid gets
 * nothing, silently, with the row left PENDING for an admin to notice.
 *
 * So the age is recorded, not enforced. What a replay could buy is the question
 * worth asking, and the answer is nothing: the signature proves the body came
 * from Finik, the amount is checked against the order, and `activatePayment`
 * only acts on a PENDING row, so replaying a real notification activates an
 * already-active subscription — a no-op. A loud log beats a lost payment.
 */
const EXPECTED_SKEW_MS = 5 * 60 * 1000;

type FinikWebhook = {
  id?: string;
  transactionId?: string;
  status?: string;
  amount?: number;
  fields?: Record<string, unknown>;
  transactionDate?: number;
};

export async function POST(request: Request) {
  const config = getFinikConfig();
  if (!config?.publicKey) {
    console.error("[finik] webhook отклонён — Finik не настроен (FINIK_API_KEY / ACCOUNT_ID / PRIVATE_KEY)");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("signature");
  const timestamp = request.headers.get("x-api-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "unsigned" }, { status: 401 });
  }

  let body: FinikWebhook;
  try {
    body = JSON.parse(raw) as FinikWebhook;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Every `x-api-*` header takes part in the signature, so they are all collected
  // rather than just the two we happen to read above.
  const headers: Record<string, string> = { host: request.headers.get("host") ?? "" };
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith("x-api-")) headers[key.toLowerCase()] = value;
  });

  const signable: SignableRequest = {
    method: "POST",
    path: new URL(request.url).pathname,
    headers,
    body: body as unknown as Record<string, unknown>,
  };

  if (!verify(signable, config.publicKey, signature)) {
    // The first webhook of a new integration is the one that fails, and it fails
    // with nothing to go on. These three are the whole list of likely causes: a
    // proxy rewriting Host, a key from the wrong environment, or an x-api-*
    // header that did not survive the hop — so all three are in the log.
    console.error("[finik] подпись не прошла проверку", {
      transactionId: body.transactionId,
      host: signable.headers.host,
      path: signable.path,
      apiHeaders: Object.keys(headers).filter((key) => key !== "host"),
      env: process.env.FINIK_ENV ?? "beta",
    });
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > EXPECTED_SKEW_MS) {
    console.warn("[finik] webhook keldi, lekin vaqti uzoq", {
      transactionId: body.transactionId,
      ageMs: Number.isFinite(age) ? age : null,
      timestamp,
    });
  }

  // Documented as arriving in mixed case, and as either "success" or "succeeded".
  const status = String(body.status ?? "").toLowerCase();
  if (!status.startsWith("succe")) {
    return NextResponse.json({ ok: true, ignored: status }, { status: 200 });
  }

  const reference = body.fields?.paymentId;
  if (typeof reference !== "string" || !reference) {
    console.error("[finik] в webhook нет paymentId", body);
    // 200 on purpose: retrying will not add the field, and a permanent failure
    // must not sit in Finik's retry queue for 24 hours.
    return NextResponse.json({ ok: true, ignored: "no paymentId" }, { status: 200 });
  }

  const payment = await db.payment.findUnique({
    where: { reference },
    select: { id: true, amountSom: true, status: true },
  });

  if (!payment) {
    console.error("[finik] неизвестный платёж", reference);
    return NextResponse.json({ ok: true, ignored: "unknown payment" }, { status: 200 });
  }

  // A mismatch means the amount was tampered with somewhere; record it and stop.
  if (typeof body.amount === "number" && body.amount !== payment.amountSom) {
    console.error("[finik] summa mos kelmadi", {
      reference,
      expected: payment.amountSom,
      got: body.amount,
    });
    // Only a payment still waiting may be failed this way. A second, odd
    // notification about an order that is already PAID must not mark it failed
    // while the subscription it bought goes on running.
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED", raw: body as never },
    });
    return NextResponse.json({ ok: true, ignored: "amount mismatch" }, { status: 200 });
  }

  const paidAt = body.transactionDate ? new Date(body.transactionDate) : new Date();

  try {
    await activatePayment(payment.id, {
      externalId: body.transactionId ?? body.id ?? null,
      raw: body,
      paidAt,
    });
  } catch (error) {
    console.error("[finik] не удалось активировать платёж", error);
    // 500 so Finik retries — this one really might succeed next time.
    return NextResponse.json({ error: "activation failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
