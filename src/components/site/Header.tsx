import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/server/dal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "./LogoutButton";

function Wordmark() {
  return (
    <Link href="/" className="group flex items-baseline gap-2">
      <span className="font-display text-[19px] leading-none text-chalk transition-colors group-hover:text-safe-soft">
        photopoly
      </span>
      <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-dust sm:inline">
        фотомастерская
      </span>
    </Link>
  );
}

const NAV_LINK =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-dust transition-colors hover:text-chalk";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      {/* Wraps below `sm` rather than running off the side. With seven links a
          phone could not reach the last of them, and the whole page scrolled
          sideways to show a navigation bar nobody was trying to read. A taller
          header on a phone is the cheaper of the two. */}
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 sm:flex-nowrap sm:py-0">
        <Wordmark />

        <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-1.5">
          <ThemeToggle />
          <Link href="/narxlar" className={NAV_LINK}>
            Цены
          </Link>

          {user ? (
            <>
              <Link href="/studio" className={NAV_LINK}>
                Редактор
              </Link>
              <Link href="/karobka" className={NAV_LINK}>
                Коробки
              </Link>
              <Link href="/zakazlar" className={NAV_LINK}>
                Заказы
              </Link>
              <Link href="/kassa" className={NAV_LINK}>
                Касса
              </Link>
              <Link href="/hisob" className={NAV_LINK}>
                Мой аккаунт
              </Link>
              {isAdmin(user.role) ? (
                <Link href="/admin" className={`${NAV_LINK} text-ember hover:text-safe`}>
                  Admin
                </Link>
              ) : null}
              <LogoutButton className={NAV_LINK} />
            </>
          ) : (
            <>
              <Link href="/kirish" className={NAV_LINK}>
                Вход
              </Link>
              <Link
                href="/royxat"
                className="border border-safe bg-safe/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-safe-soft transition-colors hover:bg-safe/20"
              >
                Начать
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
