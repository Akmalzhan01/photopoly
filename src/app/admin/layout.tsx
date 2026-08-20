import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/site/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/server/dal";

const TABS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/foydalanuvchilar", label: "Пользователи" },
  { href: "/admin/tolovlar", label: "Платежи" },
  { href: "/admin/tariflar", label: "Тарифы" },
  { href: "/admin/kostyumlar", label: "Костюмы" },
  { href: "/admin/jurnal", label: "Журнал" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-pit">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
          <Link href="/" className="font-display text-[20px] leading-none text-chalk">
            photopoly
          </Link>
          <span className="border border-ember/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ember">
            {admin.role === "SUPERADMIN" ? "Superadmin" : "Admin"}
          </span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden font-mono text-[10px] text-dust sm:inline">{admin.email}</span>
            <ThemeToggle />
            <Link
              href="/studio"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust transition-colors hover:text-chalk"
            >
              Редактор
            </Link>
            <LogoutButton className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust transition-colors hover:text-chalk" />
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-px overflow-x-auto px-5">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-3 py-2.5 font-mono text-[10px] whitespace-nowrap uppercase tracking-[0.14em] text-dust transition-colors hover:border-line-lit hover:text-chalk"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
