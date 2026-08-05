import type { ReactNode } from "react";
import { Header } from "@/components/site/Header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-display text-[15px] text-dust">photopoly</span>
          <span className="font-mono text-[10px] text-dust">
            Фотографии обрабатываются в вашем браузере — на сервер не уходят.
          </span>
          <span className="ml-auto font-mono text-[10px] text-dust">Бишкек, КР</span>
        </div>
      </footer>
    </>
  );
}
