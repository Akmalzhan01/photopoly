import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/site/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/site/ui";
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
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-chalk">
            <Logo />
            photopoly
          </Link>
          <span className="rounded-full bg-ember/10 px-2.5 py-0.5 text-[12px] font-medium text-ember">
            {admin.role === "SUPERADMIN" ? "Superadmin" : "Admin"}
          </span>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-[12px] text-dust sm:inline tabular-nums">{admin.email}</span>
            <ThemeToggle />
            <Link
              href="/studio"
              className="text-[12px] text-dust transition-colors hover:text-chalk font-medium"
            >
              Редактор
            </Link>
            <LogoutButton className="text-[12px] text-dust transition-colors hover:text-chalk font-medium" />
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-px overflow-x-auto px-5">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-3 py-2.5 text-[14px] font-medium whitespace-nowrap text-ash transition-colors hover:border-safe hover:text-chalk"
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
