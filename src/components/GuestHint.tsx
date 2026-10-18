"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GUEST_EDGE } from "@/lib/guest";

/**
 * The line under a tool's download button for a visitor who is not signed in:
 * what they will get now, and what an account adds.
 */
export function GuestHint({ saved }: { saved: string | null }) {
  const pathname = usePathname();
  const back = encodeURIComponent(pathname);

  return (
    <div className="rounded-lg border border-safe/25 bg-safe/5 px-3.5 py-3 text-[13px] leading-relaxed text-ash">
      {saved ? (
        <p className="mb-1.5 text-chalk">Сохранено: {saved}</p>
      ) : (
        <p className="mb-1.5">
          Без входа — бесплатно, до {GUEST_EDGE} px по длинной стороне.
        </p>
      )}
      <p>
        <Link href={`/royxat?keyin=${back}`} className="font-semibold text-safe-soft hover:underline">
          Зарегистрируйтесь бесплатно
        </Link>
        , чтобы скачивать в полном размере. Уже есть аккаунт?{" "}
        <Link href={`/kirish?keyin=${back}`} className="font-medium text-safe-soft hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
