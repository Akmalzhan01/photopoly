"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TOOLS = [
  { href: "/fon", title: "Убрать фон", hint: "Прозрачный, цветной или размытый фон" },
  { href: "/kattalashtirish", title: "Увеличить фото", hint: "Нейросеть, ×2 и ×4" },
  { href: "/konvert", title: "HEIC в JPG и сжатие", hint: "Сразу много файлов, архивом" },
  { href: "/karobka", title: "Коробки", hint: "Развёртка коробки под печать" },
];

/**
 * The standalone tools behind one button. Each was a link of its own until
 * there were four, and the header ran to eleven items and wrapped on a laptop.
 */
export function ToolsMenu({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = TOOLS.some((tool) => pathname.startsWith(tool.href));

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`${className} inline-flex items-center gap-1 ${active ? "text-chalk" : ""}`}
      >
        Инструменты
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Pinned to the screen edges on a phone, where the button sits mid-row
          and a right-aligned panel would hang off the left side. */}
      {open ? (
        <div
          role="menu"
          className="fixed inset-x-4 z-50 mt-2 rounded-xl border border-line bg-slab p-1.5 shadow-stage sm:absolute sm:inset-x-auto sm:right-0 sm:w-72"
        >
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 transition-colors hover:bg-riser ${
                pathname.startsWith(tool.href) ? "bg-safe/10" : ""
              }`}
            >
              <span className="block text-[14px] font-medium text-chalk">{tool.title}</span>
              <span className="block text-[12px] text-dust">{tool.hint}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
