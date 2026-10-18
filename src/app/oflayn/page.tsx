import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Нет соединения — photopoly" };

/**
 * The offline fallback the service worker keeps in its cache.
 *
 * Static on purpose: it is served to whoever happens to be at the keyboard, so
 * it must never contain anything belonging to a particular account.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md">
        <div className="mb-6 flex items-baseline gap-2.5">
          <span className="text-[12px] text-ash font-medium">
            Нет соединения
          </span>
        </div>
        <h1 className="font-display text-[36px] leading-[1.05] text-chalk font-semibold tracking-tight">
          Интернет недоступен.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-ash">
          Photopoly обрабатывает фотографии прямо в вашем браузере, но для входа в
          аккаунт нужно соединение. Обновите страницу, когда связь появится.
        </p>
        <Link
          href="/studio"
          className="mt-7 inline-flex items-center border border-transparent bg-safe px-4 py-2.5 text-[13px] text-white transition-colors hover:bg-safe/90 font-medium rounded-lg"
        >
          Попробовать снова
        </Link>
      </div>
    </main>
  );
}
