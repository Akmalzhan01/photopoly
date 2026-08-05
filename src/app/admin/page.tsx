import Link from "next/link";
import { requireAdmin } from "@/lib/server/dal";
import { expireStaleSubscriptions } from "@/lib/server/billing";
import { getAdminOverview } from "@/lib/server/stats";
import { getFreeExportLimit, getPaymentNote } from "@/lib/server/settings-store";
import { getFinikConfig } from "@/lib/finik/config";
import { Eyebrow, Notice } from "@/components/site/ui";
import { FreeLimitForm } from "@/components/admin/FreeLimitForm";
import { PaymentNoteForm } from "@/components/admin/PaymentNoteForm";
import { formatSom } from "@/lib/money";

function Tile({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">{label}</span>
      <p className="mt-2 font-mono text-[26px] leading-none text-chalk tabular-nums">{value}</p>
      {note ? <p className="mt-1.5 font-mono text-[10px] text-dust">{note}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="bg-slab p-5 transition-colors hover:bg-riser">
      {body}
    </Link>
  ) : (
    <div className="bg-slab p-5">{body}</div>
  );
}

export default async function AdminHome() {
  // expireStaleSubscriptions() is global bookkeeping unrelated to this admin,
  // so it runs alongside the session check instead of after it — the
  // database is ~200ms away, and every avoidable round trip shows.
  const [admin] = await Promise.all([requireAdmin(), expireStaleSubscriptions()]);

  const [stats, freeLimit, paymentNote] = await Promise.all([
    getAdminOverview(),
    getFreeExportLimit(),
    getPaymentNote(),
  ]);
  const finik = getFinikConfig();

  return (
    <>
      <div className="mb-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Общая картина</Eyebrow>
      </div>

      {!finik ? (
        <div className="mb-6">
          <Notice tone="warn">
            Finik не настроен — все новые заказы создаются в режиме{" "}
            <strong>ручного подтверждения</strong>. Подтверждать их нужно в разделе
            &laquo;Платежи&raquo;. Чтобы включить, задайте{" "}
            <code className="font-mono text-chalk">FINIK_API_KEY</code>,{" "}
            <code className="font-mono text-chalk">FINIK_ACCOUNT_ID</code> и{" "}
            <code className="font-mono text-chalk">FINIK_PRIVATE_KEY</code>.
          </Notice>
        </div>
      ) : !finik.publicKey ? (
        <div className="mb-6">
          <Notice tone="warn">
            <code className="font-mono text-chalk">FINIK_PUBLIC_KEY</code> не задан, поэтому
            входящие webhook’и отклоняются, а платежи не активируются
            автоматически. Возьмите ключ из документации Finik.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          label="Пользователи"
          value={formatSom(stats.users)}
          note={`за 30 дней +${formatSom(stats.newUsers)}`}
          href="/admin/foydalanuvchilar"
        />
        <Tile label="Активные подписки" value={formatSom(stats.activeSubscriptions)} />
        <Tile
          label="Платежи в ожидании"
          value={formatSom(stats.pendingPayments)}
          note={stats.pendingPayments > 0 ? "требуют подтверждения" : "все закрыты"}
          href="/admin/tolovlar"
        />
        <Tile label="Выручка за 30 дней" value={`${formatSom(stats.revenueSom)} сом`} />
        <Tile label="Экспортов за 30 дней" value={formatSom(stats.exports)} />
        <Tile
          label="Платёжная система"
          value={finik ? "Finik" : "Вручную"}
          note={finik ? (process.env.FINIK_ENV === "production" ? "production" : "beta") : "—"}
        />
      </div>

      {admin.role === "SUPERADMIN" ? (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline gap-2.5">
            <span className="font-mono text-[10px] text-ember">02</span>
            <Eyebrow>Настройки</Eyebrow>
          </div>
          <FreeLimitForm current={freeLimit} />

          {/* Only while orders are confirmed by hand; with Finik live the
              customer pays in the gateway and never reads this. */}
          {!finik ? (
            <div className="mt-4">
              <PaymentNoteForm current={paymentNote} />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
