import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/server/dal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./ui";
import { ToolsMenu } from "./ToolsMenu";

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[17px] font-semibold tracking-tight text-chalk">photopoly</span>
    </Link>
  );
}

const NAV_LINK =
  "rounded-md px-2.5 py-1.5 text-[14px] font-medium text-ash transition-colors hover:bg-riser hover:text-chalk";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
      {/* Wraps below `sm` rather than running off the side. With seven links a
          phone could not reach the last of them, and the whole page scrolled
          sideways to show a navigation bar nobody was trying to read. A taller
          header on a phone is the cheaper of the two. */}
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 lg:flex-nowrap lg:py-0">
        <Wordmark />

        <nav className="ml-auto flex flex-wrap items-center justify-end gap-x-0.5 gap-y-1">
          <Link href="/narxlar" className={NAV_LINK}>
            Цены
          </Link>

          {user ? (
            <>
              <Link href="/studio" className={NAV_LINK}>
                Редактор
              </Link>
              <ToolsMenu className={NAV_LINK} />
              <Link href="/zakazlar" className={NAV_LINK}>
                Заказы
              </Link>
              <Link href="/kassa" className={NAV_LINK}>
                Касса
              </Link>
              <Link href="/hisob" className={NAV_LINK}>
                Аккаунт
              </Link>
              {isAdmin(user.role) ? (
                <Link href="/admin" className={`${NAV_LINK} text-ember hover:text-ember`}>
                  Admin
                </Link>
              ) : null}
              <span aria-hidden className="mx-1.5 h-5 w-px bg-line" />
              <ThemeToggle className={NAV_LINK} />
              <LogoutButton className={NAV_LINK} />
            </>
          ) : (
            <>
              <ThemeToggle className={NAV_LINK} />
              <Link href="/kirish" className={NAV_LINK}>
                Вход
              </Link>
              <Link
                href="/royxat"
                className="ml-1.5 rounded-lg bg-safe px-4 py-2 text-[14px] font-medium text-white shadow-card transition-colors hover:bg-safe/90"
              >
                Начать бесплатно
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
