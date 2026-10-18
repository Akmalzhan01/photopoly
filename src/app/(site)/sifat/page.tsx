import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { QualityStudio } from "@/components/quality/QualityStudio";

export const metadata: Metadata = { title: "Качество фото — photopoly" };

/**
 * Renders nothing about the account beyond the gate.
 *
 * The allowance is fetched by the component after load, like the editor's, so
 * the markup is the same for everybody and the photograph never leaves the
 * device.
 */
export default async function QualityPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-300 px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <Eyebrow>Качество</Eyebrow>
      </div>
      <h1 className="font-display text-[clamp(30px,4.5vw,42px)] leading-[1.05] text-chalk font-semibold tracking-tight">
        Улучшить качество фото
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ash">
        Тёмный снимок с телефона, мелкое фото из мессенджера, старая печать со
        сканера. Экспозиция, зерно, резкость и увеличение — с показом «до и
        после», чтобы было видно, за что вы платите. Кадр не обрезается и фон не
        трогается.
      </p>

      <div className="mt-10">
        <QualityStudio />
      </div>

      <p className="mt-10 max-w-2xl text-[12px] leading-relaxed text-dust">
        Фото на документы — в{""}
        <Link href="/studio" className="text-safe-soft underline-offset-2 hover:underline">
          редакторе
        </Link>
        : там это же улучшение идёт по пути к точному размеру. Работу можно
        завести в{""}
        <Link href="/zakazlar/yangi" className="text-safe-soft underline-offset-2 hover:underline">
          заказы
        </Link>{""}
        как «Ретушь и обработка».
      </p>
    </div>
  );
}
