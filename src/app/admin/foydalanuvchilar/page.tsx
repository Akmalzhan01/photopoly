import Link from "next/link";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/dal";
import { getFreeExportLimit } from "@/lib/server/settings-store";
import { Eyebrow } from "@/components/site/ui";
import { UserRow } from "@/components/admin/UserRow";

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const admin = await requireAdmin();
  const { q, p } = await searchParams;

  const query = (q ?? "").trim();
  const page = Math.max(1, Number.parseInt(p ?? "1", 10) || 1);

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total, plans, freeLimit] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        blocked: true,
        freeUsed: true,
        createdAt: true,
        subscriptions: {
          where: { status: "ACTIVE", endsAt: { gt: new Date() } },
          orderBy: { endsAt: "desc" },
          take: 1,
          select: { id: true, endsAt: true, used: true, plan: { select: { name: true } } },
        },
        _count: { select: { usage: true } },
      },
    }),
    db.user.count({ where }),
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
    getFreeExportLimit(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-3">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Пользователи</Eyebrow>
        <span className="font-mono text-[10px] text-dust">{total}</span>

        <form className="ml-auto flex items-center gap-2" action="/admin/foydalanuvchilar">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Почта или имя"
            aria-label="Поиск пользователя"
            className="w-52 border border-line bg-pit px-3 py-1.5 font-mono text-[11px] text-chalk outline-none transition-colors placeholder:text-dust focus:border-safe/50"
          />
          <button
            type="submit"
            className="border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-line-lit hover:text-chalk"
          >
            Найти
          </button>
        </form>
      </div>

      {users.length === 0 ? (
        <div className="border border-line bg-slab p-6">
          <p className="text-[13px] text-ash">
            {query ? `По запросу «${query}» никого не найдено.` : "Пользователей пока нет."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-px bg-line">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={{
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                blocked: user.blocked,
                freeUsed: user.freeUsed,
                createdAt: user.createdAt.toISOString(),
                exports: user._count.usage,
                subscription: user.subscriptions[0]
                  ? {
                      id: user.subscriptions[0].id,
                      planName: user.subscriptions[0].plan.name,
                      endsAt: user.subscriptions[0].endsAt.toISOString(),
                      used: user.subscriptions[0].used,
                    }
                  : null,
              }}
              plans={plans}
              freeLimit={freeLimit}
              isSelf={user.id === admin.id}
              canSetRole={admin.role === "SUPERADMIN"}
            />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-6 flex items-center gap-2">
          {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
            <Link
              key={number}
              href={`/admin/foydalanuvchilar?${new URLSearchParams({
                ...(query ? { q: query } : {}),
                p: String(number),
              })}`}
              aria-current={number === page ? "page" : undefined}
              className={`border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                number === page
                  ? "border-safe text-safe-soft"
                  : "border-line text-dust hover:border-line-lit hover:text-chalk"
              }`}
            >
              {number}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
